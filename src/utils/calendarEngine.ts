/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseScheduleItem,
  SupportScheduleItem,
  DailySessionRecord,
  AttendanceStatus,
} from '../types/index.ts';
import {
  parseLocalDate,
  formatLocalDate,
  getSaturdayOfWeek,
  getThursdayOfWeek,
  DAY_NAMES_ARABIC,
  parseTimeToMinutes,
} from './dateUtils.ts';

export type CalendarSessionStatus =
  | 'completed'        // 🟢 أخضر: مسجلة ومنجزة
  | 'unrecorded_past'  // 🔴 أحمر: انتهى موعدها ولم تُسجل بعد (تحتاج مراجعة)
  | 'upcoming_future'  // ⚪ رمادي: حصة مستقبلية لم يحن موعدها بعد
  | 'late'             // 🟠 أصفر/برتقالي: مسجلة مع تأخر
  | 'absent'           // 🟣 بنفسجي/وردي: غياب مسجل صراحة
  | 'cancelled';       // 🔵 أزرق: ملغاة بقرار المدرسة

export interface CalendarSessionItem {
  id: string; // Composite ID: `${scheduleItemId || 'dated'}_${dateStr}`
  scheduleItemId?: string;
  sourceType: 'base' | 'support' | 'extra';
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0..6
  dayNameArabic: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  subject: string;
  groupName?: string;
  notes?: string;
  isRecorded: boolean;
  calendarStatus: CalendarSessionStatus;
  statusLabelArabic: string;
  record?: DailySessionRecord;
}

export interface CalendarDayData {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 6=Sat, 0=Sun, ..., 5=Fri
  dayNameArabic: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  sessions: CalendarSessionItem[];
}

export interface WeekCalendarSummary {
  saturdayDate: string;
  thursdayDate: string;
  fridayDate: string;
  totalProgrammed: number;
  recordedCount: number;
  unrecordedPastCount: number;
  upcomingCount: number;
  cancelledCount: number;
  absencesCount: number;
  delaysCount: number;
  recordingPercentage: number;
  days: CalendarDayData[];
}

/**
 * Determines whether a session's scheduled end time on a given date has already passed.
 */
export function isSessionPast(sessionDateStr: string, sessionEndTimeStr: string, now: Date = new Date()): boolean {
  const todayStr = formatLocalDate(now);
  if (sessionDateStr < todayStr) {
    return true;
  }
  if (sessionDateStr > todayStr) {
    return false;
  }
  // Same day: compare current time with session end time
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = parseTimeToMinutes(sessionEndTimeStr);
  return currentMinutes >= endMinutes;
}

/**
 * Resolves a scheduled session into its appropriate calendar status and label.
 */
export function resolveCalendarSessionStatus(
  dateStr: string,
  endTimeStr: string,
  record?: DailySessionRecord,
  now: Date = new Date()
): { status: CalendarSessionStatus; label: string; isRecorded: boolean } {
  if (record) {
    if (record.status === 'present') {
      return { status: 'completed', label: 'حاضر ومنجز', isRecorded: true };
    }
    if (record.status === 'late') {
      return { status: 'late', label: `متأخر (${record.delayMinutes || 0} د)`, isRecorded: true };
    }
    if (record.status === 'absent') {
      return { status: 'absent', label: 'غياب مسجل', isRecorded: true };
    }
    if (record.status === 'cancelled_by_school') {
      return { status: 'cancelled', label: 'ملغاة بقرار المدرسة', isRecorded: true };
    }
    // If recorded with duration > 0
    if (record.actualDurationMinutes > 0) {
      return { status: 'completed', label: 'منجز', isRecorded: true };
    }
  }

  // Not recorded: check if past or future
  const isPast = isSessionPast(dateStr, endTimeStr, now);
  if (isPast) {
    return { status: 'unrecorded_past', label: 'لم يتم التسجيل', isRecorded: false };
  }
  return { status: 'upcoming_future', label: 'لم يحن موعدها', isRecorded: false };
}

/**
 * Resolves the 7 calendar days of a week starting on Saturday and ending on Friday.
 */
export function resolveWeekCalendar(
  saturdayDateStr: string,
  baseSchedule: BaseScheduleItem[] = [],
  supportSchedule: SupportScheduleItem[] = [],
  dailyRecords: DailySessionRecord[] = [],
  now: Date = new Date()
): WeekCalendarSummary {
  const satDate = parseLocalDate(saturdayDateStr);
  const todayStr = formatLocalDate(now);

  // 7 days in school calendar: Saturday (offset 0) to Friday (offset 6)
  const days: CalendarDayData[] = [];
  let totalProgrammed = 0;
  let recordedCount = 0;
  let unrecordedPastCount = 0;
  let upcomingCount = 0;
  let cancelledCount = 0;
  let absencesCount = 0;
  let delaysCount = 0;

  for (let offset = 0; offset < 7; offset++) {
    const curDate = new Date(satDate);
    curDate.setDate(satDate.getDate() + offset);
    const dateStr = formatLocalDate(curDate);
    const dayOfWeek = curDate.getDay();
    const dayNameArabic = DAY_NAMES_ARABIC[dayOfWeek] || '';

    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    const isFuture = dateStr > todayStr;

    const daySessions: CalendarSessionItem[] = [];

    // 1. Base schedule items for this day of week
    const activeBaseItems = baseSchedule.filter(
      (b) => b.isActive && b.dayOfWeek === dayOfWeek
    );

    for (const baseItem of activeBaseItems) {
      // Find matching record in dailyRecords for this date and baseScheduleId
      const record = dailyRecords.find(
        (r) => r.date === dateStr && r.baseScheduleId === baseItem.id
      );

      const endTime = baseItem.endTime || '08:55';
      const { status, label, isRecorded } = resolveCalendarSessionStatus(dateStr, endTime, record, now);

      daySessions.push({
        id: `base_${baseItem.id}_${dateStr}`,
        scheduleItemId: baseItem.id,
        sourceType: 'base',
        date: dateStr,
        dayOfWeek,
        dayNameArabic,
        startTime: baseItem.startTime || '08:00',
        endTime,
        durationMinutes: baseItem.durationMinutes || 55,
        subject: baseItem.subject || 'حصة أساسية',
        groupName: baseItem.gradeClass,
        notes: baseItem.notes,
        isRecorded,
        calendarStatus: status,
        statusLabelArabic: label,
        record,
      });
    }

    // 2. Support schedule items for this day of week
    const activeSupportItems = supportSchedule.filter(
      (s) => s.isActive && s.dayOfWeek === dayOfWeek
    );

    for (const suppItem of activeSupportItems) {
      const record = dailyRecords.find(
        (r) => r.date === dateStr && r.supportScheduleId === suppItem.id
      );

      const startTime = suppItem.startTime || '16:00';
      const duration = suppItem.defaultDurationMinutes || 60;
      // Calculate endTime from start + duration
      const startMin = parseTimeToMinutes(startTime);
      const endMin = startMin + duration;
      const endH = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
      const endM = String(endMin % 60).padStart(2, '0');
      const endTime = `${endH}:${endM}`;

      const { status, label, isRecorded } = resolveCalendarSessionStatus(dateStr, endTime, record, now);

      daySessions.push({
        id: `supp_${suppItem.id}_${dateStr}`,
        scheduleItemId: suppItem.id,
        sourceType: 'support',
        date: dateStr,
        dayOfWeek,
        dayNameArabic,
        startTime,
        endTime,
        durationMinutes: duration,
        subject: suppItem.subject || 'حصة دعم',
        groupName: suppItem.groupName,
        notes: suppItem.notes,
        isRecorded,
        calendarStatus: status,
        statusLabelArabic: label,
        record,
      });
    }

    // 3. Dated extra sessions logged for this specific date (standalone)
    const datedExtras = dailyRecords.filter(
      (r) => r.date === dateStr && !r.baseScheduleId && !r.supportScheduleId
    );

    for (const extra of datedExtras) {
      const startTime = extra.scheduledStartTime || '14:00';
      const endTime = extra.scheduledEndTime || '15:00';
      const { status, label, isRecorded } = resolveCalendarSessionStatus(dateStr, endTime, extra, now);

      daySessions.push({
        id: `extra_${extra.id}`,
        sourceType: 'extra',
        date: dateStr,
        dayOfWeek,
        dayNameArabic,
        startTime,
        endTime,
        durationMinutes: extra.actualDurationMinutes || extra.scheduledDurationMinutes || 60,
        subject: extra.subject || 'حصة إضافية استثنائية',
        groupName: extra.groupName,
        notes: extra.notes,
        isRecorded,
        calendarStatus: status,
        statusLabelArabic: label,
        record: extra,
      });
    }

    // Sort sessions of the day chronologically by start time
    daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Aggregate statistics
    for (const s of daySessions) {
      totalProgrammed++;
      if (s.isRecorded) {
        recordedCount++;
        if (s.calendarStatus === 'absent') absencesCount++;
        if (s.calendarStatus === 'late') delaysCount++;
        if (s.calendarStatus === 'cancelled') cancelledCount++;
      } else {
        if (s.calendarStatus === 'unrecorded_past') {
          unrecordedPastCount++;
        } else if (s.calendarStatus === 'upcoming_future') {
          upcomingCount++;
        }
      }
    }

    days.push({
      date: dateStr,
      dayOfWeek,
      dayNameArabic,
      isToday,
      isPast,
      isFuture,
      sessions: daySessions,
    });
  }

  const recordingPercentage =
    totalProgrammed === 0 ? 100 : Math.round((recordedCount / totalProgrammed) * 100);

  const thursdayDate = getThursdayOfWeek(saturdayDateStr);
  const friDateObj = parseLocalDate(saturdayDateStr);
  friDateObj.setDate(friDateObj.getDate() + 6);
  const fridayDate = formatLocalDate(friDateObj);

  return {
    saturdayDate: saturdayDateStr,
    thursdayDate,
    fridayDate,
    totalProgrammed,
    recordedCount,
    unrecordedPastCount,
    upcomingCount,
    cancelledCount,
    absencesCount,
    delaysCount,
    recordingPercentage,
    days,
  };
}

/**
 * Searches across recent weeks (e.g. past 4 weeks) for any programmed sessions that
 * ended in the past without being recorded.
 * Used for the Dashboard review widget and warnings!
 */
export function findUnrecordedSessionsAcrossRecentWeeks(
  baseSchedule: BaseScheduleItem[] = [],
  supportSchedule: SupportScheduleItem[] = [],
  dailyRecords: DailySessionRecord[] = [],
  maxWeeksBack: number = 4,
  now: Date = new Date()
): CalendarSessionItem[] {
  const todayStr = formatLocalDate(now);
  const currentSatStr = getSaturdayOfWeek(todayStr);
  const unrecordedList: CalendarSessionItem[] = [];

  for (let weekOffset = 0; weekOffset <= maxWeeksBack; weekOffset++) {
    const curSatDate = parseLocalDate(currentSatStr);
    curSatDate.setDate(curSatDate.getDate() - weekOffset * 7);
    const satStr = formatLocalDate(curSatDate);

    const weekSummary = resolveWeekCalendar(
      satStr,
      baseSchedule,
      supportSchedule,
      dailyRecords,
      now
    );

    for (const day of weekSummary.days) {
      for (const session of day.sessions) {
        if (session.calendarStatus === 'unrecorded_past') {
          unrecordedList.push(session);
        }
      }
    }
  }

  // Sort descending by date, then by time
  return unrecordedList.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.startTime.localeCompare(a.startTime);
  });
}
