/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AppSettings,
  DailySessionRecord,
  WeekRecord,
  BaseScheduleItem,
  LiquidationMethod,
  LiquidationSummarySnapshot,
} from '../types/index.ts';
import { getSaturdayOfWeek, getThursdayOfWeek } from './dateUtils.ts';

export interface WeekCalculationResult {
  weekId: string;
  startDate: string;
  endDate: string;
  status: 'unreviewed' | 'in_progress' | 'approved';
  isApproved: boolean;
  approvalDate?: string;
  reopenReason?: string;
  // Metrics
  scheduledBaseMinutes: number;
  completedBaseMinutes: number;
  completedExtraMinutes: number;
  absencesCount: number;
  absencesMinutes: number;
  delaysCount: number;
  delaysMinutes: number;
  unrecordedSessionsCount: number;
  requiredReferenceMinutes: number;
  netMinutes: number; // If approved, (completedBase + completedExtra) - requiredReference. If not approved, 0.
  provisionalNetMinutes: number; // For preview only, does not enter approved balance
}

export interface PeriodSummaryResult {
  startDate?: string;
  endDate?: string;
  totalWeeksInPeriod: number;
  evaluatedWeeksCount: number;
  unevaluatedWeeksCount: number;
  evaluatedWeekIds: string[];
  
  // Approved / Evaluated totals ONLY
  approvedRequiredReferenceMinutes: number;
  approvedBaseCompletedMinutes: number;
  approvedExtraCompletedMinutes: number;
  approvedAbsencesCount: number;
  approvedAbsencesMinutes: number;
  approvedDelaysCount: number;
  approvedDelaysMinutes: number;
  approvedNetMinutes: number;

  // Formatted representations
  isPositive: boolean;
  hours: number;
  minutes: number;
  equivalentSessions: number;
  remainderMinutes: number;
  formattedTimeText: string;
  formattedSessionsText: string;

  // Unapproved totals (informational only)
  unapprovedExtraMinutes: number;
  unapprovedBaseMinutes: number;
  unapprovedAbsencesMinutes: number;
  unapprovedDelaysMinutes: number;
  unapprovedProvisionalNetMinutes: number;

  // Financial
  rateApplied: number;
  methodApplied: LiquidationMethod;
  manualAdjustment: number;
  manualAdjustmentReason?: string;
  financialAmount: number;
  beneficiary: 'teacher' | 'school' | 'balanced';
}

/**
 * Calculates metrics for an individual week
 */
export function calculateWeekMetrics(
  week: WeekRecord,
  records: DailySessionRecord[],
  baseSchedule: BaseScheduleItem[],
  settings: AppSettings
): WeekCalculationResult {
  const weekRecords = records.filter(
    (r) => r.date >= week.startDate && r.date <= week.endDate
  );

  let scheduledBaseMinutes = 0;
  let completedBaseMinutes = 0;
  let completedExtraMinutes = 0;
  let absencesCount = 0;
  let absencesMinutes = 0;
  let delaysCount = 0;
  let delaysMinutes = 0;
  let unrecordedSessionsCount = 0;

  for (const record of weekRecords) {
    if (record.type === 'base') {
      scheduledBaseMinutes += record.scheduledDurationMinutes;

      switch (record.status) {
        case 'present':
          completedBaseMinutes += record.actualDurationMinutes > 0
            ? record.actualDurationMinutes
            : record.scheduledDurationMinutes;
          break;

        case 'absent':
          absencesCount += 1;
          absencesMinutes += record.scheduledDurationMinutes;
          // Completed base is 0 for this session
          break;

        case 'late':
          delaysCount += 1;
          delaysMinutes += Math.max(0, record.delayMinutes);
          // If actual duration is specified and positive, use it.
          // Otherwise, completed = scheduledDuration - delayMinutes
          if (record.actualDurationMinutes > 0) {
            completedBaseMinutes += record.actualDurationMinutes;
          } else {
            const effectiveCompleted = Math.max(0, record.scheduledDurationMinutes - record.delayMinutes);
            completedBaseMinutes += effectiveCompleted;
          }
          break;

        case 'cancelled_by_school':
          if (settings.schoolCancellationPolicy === 'waived_as_completed') {
            // Counted as completed so the teacher is not penalized for school cancellation
            completedBaseMinutes += record.scheduledDurationMinutes;
          }
          break;

        case 'unrecorded':
        default:
          unrecordedSessionsCount += 1;
          break;
      }
    } else {
      // Extra / Support sessions
      if (record.actualDurationMinutes > 0) {
        completedExtraMinutes += record.actualDurationMinutes;
      }
    }
  }

  // If base records were not yet created for all active schedule items in this week,
  // we count base schedule scheduled minutes if greater
  const activeBaseScheduledTotal = baseSchedule
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + item.durationMinutes, 0);

  if (scheduledBaseMinutes === 0 && activeBaseScheduledTotal > 0) {
    scheduledBaseMinutes = activeBaseScheduledTotal;
  }

  const requiredReferenceMinutes = settings.referenceWeeklyHours * 60;
  const isApproved = week.status === 'approved';

  // Provisional net minutes (for preview)
  const provisionalNetMinutes = (completedBaseMinutes + completedExtraMinutes) - requiredReferenceMinutes;

  // Approved Net Minutes: strictly 0 if week is not approved!
  const netMinutes = isApproved ? provisionalNetMinutes : 0;

  return {
    weekId: week.id,
    startDate: week.startDate,
    endDate: week.endDate,
    status: week.status,
    isApproved,
    approvalDate: week.approvalDate,
    reopenReason: week.reopenReason,
    scheduledBaseMinutes,
    completedBaseMinutes,
    completedExtraMinutes,
    absencesCount,
    absencesMinutes,
    delaysCount,
    delaysMinutes,
    unrecordedSessionsCount,
    requiredReferenceMinutes,
    netMinutes,
    provisionalNetMinutes,
  };
}

/**
 * Converts net minutes into hours, minutes, sessions, and remainder
 */
export function convertMinutesToSessions(
  netMinutes: number,
  sessionDuration = 55
): {
  isPositive: boolean;
  hours: number;
  minutes: number;
  equivalentSessions: number;
  remainderMinutes: number;
  formattedTimeText: string;
  formattedSessionsText: string;
} {
  const isPositive = netMinutes >= 0;
  const absMin = Math.abs(netMinutes);
  const hours = Math.floor(absMin / 60);
  const minutes = absMin % 60;
  const equivalentSessions = Math.floor(absMin / sessionDuration);
  const remainderMinutes = absMin % sessionDuration;

  const sign = isPositive ? '+' : '-';
  const formattedTimeText = `${sign}${hours} س و ${minutes} د`;
  const sessionWord = equivalentSessions === 1 ? 'حصة' : equivalentSessions === 2 ? 'حصتان' : 'حصص';
  const formattedSessionsText = `${sign}${equivalentSessions} ${sessionWord} و ${remainderMinutes} دقيقة`;

  return {
    isPositive,
    hours,
    minutes,
    equivalentSessions,
    remainderMinutes,
    formattedTimeText,
    formattedSessionsText,
  };
}

/**
 * Calculates the exact financial valuation
 */
export function calculateFinancialAmount(
  netMinutes: number,
  method: LiquidationMethod,
  rate: number,
  manualAdjustment = 0
): {
  baseAmount: number;
  finalAmount: number;
  beneficiary: 'teacher' | 'school' | 'balanced';
} {
  if (rate <= 0) {
    const finalAmount = manualAdjustment;
    const beneficiary = finalAmount > 0.001 ? 'teacher' : finalAmount < -0.001 ? 'school' : 'balanced';
    return { baseAmount: 0, finalAmount, beneficiary };
  }

  let baseAmount = 0;
  if (method === 'per_session') {
    // Each 55 minutes is 1 session
    baseAmount = (netMinutes / 55) * rate;
  } else {
    // Each 60 minutes is 1 hour
    baseAmount = (netMinutes / 60) * rate;
  }

  const finalAmount = baseAmount + manualAdjustment;
  const beneficiary = finalAmount > 0.001 ? 'teacher' : finalAmount < -0.001 ? 'school' : 'balanced';

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    finalAmount: Math.round(finalAmount * 100) / 100,
    beneficiary,
  };
}

/**
 * Primary calculation engine function:
 * Aggregates all weeks and records within a given period, strictly separating
 * approved weeks from un-evaluated weeks.
 */
export function calculatePeriodSummary(
  weeks: WeekRecord[],
  records: DailySessionRecord[],
  baseSchedule: BaseScheduleItem[],
  settings: AppSettings,
  filter?: {
    startDate?: string;
    endDate?: string;
    rate?: number;
    method?: LiquidationMethod;
    manualAdjustment?: number;
    manualAdjustmentReason?: string;
  }
): PeriodSummaryResult {
  const startDate = filter?.startDate;
  const endDate = filter?.endDate;

  // Filter weeks that intersect or fall into the period
  const filteredWeeks = weeks.filter((w) => {
    if (!startDate && !endDate) return true;
    if (startDate && w.endDate < startDate) return false;
    if (endDate && w.startDate > endDate) return false;
    return true;
  });

  const weekResults = filteredWeeks.map((w) =>
    calculateWeekMetrics(w, records, baseSchedule, settings)
  );

  let approvedRequiredReferenceMinutes = 0;
  let approvedBaseCompletedMinutes = 0;
  let approvedExtraCompletedMinutes = 0;
  let approvedAbsencesCount = 0;
  let approvedAbsencesMinutes = 0;
  let approvedDelaysCount = 0;
  let approvedDelaysMinutes = 0;
  let approvedNetMinutes = 0;
  const evaluatedWeekIds: string[] = [];

  let unapprovedExtraMinutes = 0;
  let unapprovedBaseMinutes = 0;
  let unapprovedAbsencesMinutes = 0;
  let unapprovedDelaysMinutes = 0;
  let unapprovedProvisionalNetMinutes = 0;

  let evaluatedWeeksCount = 0;
  let unevaluatedWeeksCount = 0;

  for (const wr of weekResults) {
    if (wr.isApproved) {
      evaluatedWeeksCount += 1;
      evaluatedWeekIds.push(wr.weekId);
      approvedRequiredReferenceMinutes += wr.requiredReferenceMinutes;
      approvedBaseCompletedMinutes += wr.completedBaseMinutes;
      approvedExtraCompletedMinutes += wr.completedExtraMinutes;
      approvedAbsencesCount += wr.absencesCount;
      approvedAbsencesMinutes += wr.absencesMinutes;
      approvedDelaysCount += wr.delaysCount;
      approvedDelaysMinutes += wr.delaysMinutes;
      approvedNetMinutes += wr.netMinutes;
    } else {
      unevaluatedWeeksCount += 1;
      unapprovedExtraMinutes += wr.completedExtraMinutes;
      unapprovedBaseMinutes += wr.completedBaseMinutes;
      unapprovedAbsencesMinutes += wr.absencesMinutes;
      unapprovedDelaysMinutes += wr.delaysMinutes;
      unapprovedProvisionalNetMinutes += wr.provisionalNetMinutes;
    }
  }

  const converted = convertMinutesToSessions(
    approvedNetMinutes,
    settings.referenceSessionDurationMinutes || 55
  );

  const rateApplied = filter?.rate !== undefined
    ? filter.rate
    : (filter?.method === 'per_session' ? settings.pricePerSession : settings.pricePerHour);

  const methodApplied = filter?.method || settings.liquidationMethod || 'per_session';
  const manualAdjustment = filter?.manualAdjustment || 0;

  const financial = calculateFinancialAmount(
    approvedNetMinutes,
    methodApplied,
    rateApplied,
    manualAdjustment
  );

  return {
    startDate,
    endDate,
    totalWeeksInPeriod: filteredWeeks.length,
    evaluatedWeeksCount,
    unevaluatedWeeksCount,
    evaluatedWeekIds,
    approvedRequiredReferenceMinutes,
    approvedBaseCompletedMinutes,
    approvedExtraCompletedMinutes,
    approvedAbsencesCount,
    approvedAbsencesMinutes,
    approvedDelaysCount,
    approvedDelaysMinutes,
    approvedNetMinutes,
    isPositive: converted.isPositive,
    hours: converted.hours,
    minutes: converted.minutes,
    equivalentSessions: converted.equivalentSessions,
    remainderMinutes: converted.remainderMinutes,
    formattedTimeText: converted.formattedTimeText,
    formattedSessionsText: converted.formattedSessionsText,
    unapprovedExtraMinutes,
    unapprovedBaseMinutes,
    unapprovedAbsencesMinutes,
    unapprovedDelaysMinutes,
    unapprovedProvisionalNetMinutes,
    rateApplied,
    methodApplied,
    manualAdjustment,
    manualAdjustmentReason: filter?.manualAdjustmentReason,
    financialAmount: financial.finalAmount,
    beneficiary: financial.beneficiary,
  };
}

/**
 * Creates a permanent snapshot object from a period summary
 */
export function createLiquidationSnapshot(
  summary: PeriodSummaryResult
): LiquidationSummarySnapshot {
  return {
    evaluatedWeeksCount: summary.evaluatedWeeksCount,
    unevaluatedWeeksCount: summary.unevaluatedWeeksCount,
    totalRequiredReferenceMinutes: summary.approvedRequiredReferenceMinutes,
    totalBaseCompletedMinutes: summary.approvedBaseCompletedMinutes,
    totalExtraCompletedMinutes: summary.approvedExtraCompletedMinutes,
    totalAbsencesCount: summary.approvedAbsencesCount,
    totalAbsencesMinutes: summary.approvedAbsencesMinutes,
    totalDelaysCount: summary.approvedDelaysCount,
    totalDelaysMinutes: summary.approvedDelaysMinutes,
    netMinutes: summary.approvedNetMinutes,
    hours: summary.hours,
    minutes: summary.minutes,
    equivalentSessions: summary.equivalentSessions,
    remainderMinutes: summary.remainderMinutes,
    rateApplied: summary.rateApplied,
    methodApplied: summary.methodApplied,
    manualAdjustment: summary.manualAdjustment,
    manualAdjustmentReason: summary.manualAdjustmentReason,
    financialAmount: summary.financialAmount,
    beneficiary: summary.beneficiary,
    evaluatedWeekIds: [...summary.evaluatedWeekIds],
  };
}
