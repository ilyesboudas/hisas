/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrainingAssignment, TrainingAssignmentType, TrainingAssignmentStatus } from '../types/index.ts';

export const DEFAULT_TRAINING_TARGET_HOURS = 16;
export const DEFAULT_TRAINING_TARGET_MINUTES = DEFAULT_TRAINING_TARGET_HOURS * 60; // 960 minutes

export interface TrainingMetrics {
  academicYear: string;
  targetHours: number;
  targetMinutes: number; // e.g. 960
  completedMinutes: number; // Sum of completed activities
  remainingMinutes: number; // max(0, targetMinutes - completedMinutes)
  surplusMinutes: number; // max(0, completedMinutes - targetMinutes)
  progressPercentage: number; // (completedMinutes / targetMinutes) * 100
  cappedProgressPercentage: number; // min(100, progressPercentage)
  isTargetMet: boolean;
  hasSurplus: boolean;
  
  // Counts
  trainingsCount: number; // all trainings in season
  assignmentsCount: number; // all assignments in season
  completedTrainingsCount: number;
  completedAssignmentsCount: number;
  inProgressCount: number;
  totalActivitiesCount: number;
}

export interface FormattedDuration {
  hours: number;
  minutes: number;
  totalMinutes: number;
  compactText: string; // e.g. "3 سا 30 د"
  fullText: string;    // e.g. "3 ساعات و30 دقيقة"
}

/**
 * Formats duration in minutes to hours and minutes in clean Arabic representation
 */
export function formatMinutesToArabic(totalMinutes: number): FormattedDuration {
  const safeMinutes = Math.max(0, Math.round(totalMinutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  let compactText = '';
  if (hours > 0 && minutes > 0) {
    compactText = `${hours} سا ${minutes} د`;
  } else if (hours > 0) {
    compactText = `${hours} سا`;
  } else {
    compactText = `${minutes} د`;
  }

  let fullText = '';
  if (hours === 0 && minutes === 0) {
    fullText = '0 دقيقة';
  } else if (hours === 0) {
    fullText = `${minutes} دقيقة`;
  } else {
    let hoursStr = '';
    if (hours === 1) hoursStr = 'ساعة واحدة';
    else if (hours === 2) hoursStr = 'ساعتان';
    else if (hours >= 3 && hours <= 10) hoursStr = `${hours} ساعات`;
    else hoursStr = `${hours} ساعة`;

    if (minutes === 0) {
      fullText = hoursStr;
    } else {
      fullText = `${hoursStr} و${minutes} دقيقة`;
    }
  }

  return {
    hours,
    minutes,
    totalMinutes: safeMinutes,
    compactText,
    fullText,
  };
}

/**
 * Calculates metrics strictly for a specified academic season
 */
export function calculateSeasonTrainingMetrics(
  activities: TrainingAssignment[],
  academicYear: string,
  targetHours = DEFAULT_TRAINING_TARGET_HOURS
): TrainingMetrics {
  const targetMinutes = Math.max(1, Math.round(targetHours * 60));

  // Filter strictly by the designated academic year
  const seasonActivities = activities.filter((act) => act.academicYear === academicYear);

  let completedMinutes = 0;
  let trainingsCount = 0;
  let assignmentsCount = 0;
  let completedTrainingsCount = 0;
  let completedAssignmentsCount = 0;
  let inProgressCount = 0;

  for (const act of seasonActivities) {
    if (act.type === 'training') {
      trainingsCount++;
      if (act.status === 'completed') {
        completedTrainingsCount++;
      }
    } else if (act.type === 'assignment') {
      assignmentsCount++;
      if (act.status === 'completed') {
        completedAssignmentsCount++;
      }
    }

    if (act.status === 'completed') {
      completedMinutes += Math.max(0, Math.round(act.durationMinutes || 0));
    } else if (act.status === 'in_progress') {
      inProgressCount++;
    }
  }

  const remainingMinutes = Math.max(0, targetMinutes - completedMinutes);
  const surplusMinutes = Math.max(0, completedMinutes - targetMinutes);
  const progressPercentage = (completedMinutes / targetMinutes) * 100;
  const cappedProgressPercentage = Math.min(100, Math.max(0, progressPercentage));

  return {
    academicYear,
    targetHours,
    targetMinutes,
    completedMinutes,
    remainingMinutes,
    surplusMinutes,
    progressPercentage,
    cappedProgressPercentage,
    isTargetMet: completedMinutes >= targetMinutes,
    hasSurplus: surplusMinutes > 0,
    trainingsCount,
    assignmentsCount,
    completedTrainingsCount,
    completedAssignmentsCount,
    inProgressCount,
    totalActivitiesCount: seasonActivities.length,
  };
}

/**
 * Validates a training/assignment entry
 */
export function validateTrainingAssignmentInput(data: {
  type: TrainingAssignmentType;
  date: string;
  durationMinutes: number;
  status: TrainingAssignmentStatus;
  academicYear: string;
}): { isValid: boolean; error?: string } {
  if (!data.type || (data.type !== 'training' && data.type !== 'assignment')) {
    return { isValid: false, error: 'يرجى تحديد نوع النشاط: تكوين أو تكليف.' };
  }

  if (!data.academicYear || data.academicYear.trim() === '') {
    return { isValid: false, error: 'يرجى تحديد الموسم الدراسي.' };
  }

  if (!data.date || data.date.trim() === '') {
    return { isValid: false, error: 'يرجى إدخال تاريخ النشاط.' };
  }

  if (typeof data.durationMinutes !== 'number' || isNaN(data.durationMinutes) || data.durationMinutes < 0) {
    return { isValid: false, error: 'المدة المنجزة لا يمكن أن تكون سالبة.' };
  }

  // A completed activity cannot be saved with 0 or empty duration
  if (data.status === 'completed' && data.durationMinutes <= 0) {
    return { isValid: false, error: 'النشاط المنجز يتطلب تسجيل مدة صحيحة أكبر من الصفر.' };
  }

  return { isValid: true };
}

/**
 * Extracts all unique academic seasons present in the records, ensuring the current default is included
 */
export function getAvailableAcademicYears(
  activities: TrainingAssignment[] = [],
  currentDefaultYear = '2026-2027'
): string[] {
  const set = new Set<string>();
  if (currentDefaultYear) {
    set.add(currentDefaultYear);
  }
  for (const act of activities) {
    if (act.academicYear && act.academicYear.trim() !== '') {
      set.add(act.academicYear.trim());
    }
  }

  // Sort descending so the newest academic seasons appear first
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
