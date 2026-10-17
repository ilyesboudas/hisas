/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DAY_NAMES_ARABIC: Record<number, string> = {
  6: 'السبت',
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
};

export const WEEK_DAYS_ORDER = [6, 0, 1, 2, 3, 4]; // School days: Sat -> Thu

/**
 * Parses YYYY-MM-DD into a local Date without UTC offset shifts
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the Saturday (week start) for any given date string (YYYY-MM-DD)
 */
export function getSaturdayOfWeek(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  
  // Offset to previous Saturday
  // Sat(6) => 0
  // Sun(0) => -1
  // Mon(1) => -2
  // Tue(2) => -3
  // Wed(3) => -4
  // Thu(4) => -5
  // Fri(5) => -6
  const offset = day === 6 ? 0 : day + 1;
  
  const saturday = new Date(date);
  saturday.setDate(date.getDate() - offset);
  return formatLocalDate(saturday);
}

/**
 * Returns the Thursday (week end) given the Saturday string
 */
export function getThursdayOfWeek(saturdayStr: string): string {
  const saturday = parseLocalDate(saturdayStr);
  const thursday = new Date(saturday);
  thursday.setDate(saturday.getDate() + 5);
  return formatLocalDate(thursday);
}

/**
 * Generates a consistent week ID from date
 */
export function getWeekIdForDate(dateStr: string): string {
  const sat = getSaturdayOfWeek(dateStr);
  return `week_${sat}`;
}

/**
 * Parse time string HH:mm to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Format minutes from midnight to HH:mm
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, totalMinutes) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates duration between start and end time.
 * Handles crossing midnight if end < start.
 * Returns negative if invalid or non-sensical (> 12 hours).
 */
export function calculateIntervalMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  let diff = end - start;
  // If crossing midnight (e.g. 23:00 to 01:00)
  if (diff < 0) {
    diff += 1440; // 24 hours in minutes
  }

  // Non-sensical duration check: teaching sessions should not exceed 8 hours (480 min)
  if (diff > 480 || diff <= 0) {
    return diff <= 0 ? 0 : -1; // -1 indicates non-sensical
  }

  return diff;
}

/**
 * Checks if two time intervals on the same day overlap
 */
export function checkTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parseTimeToMinutes(start1);
  let e1 = parseTimeToMinutes(end1);
  if (e1 <= s1) e1 += 1440;

  const s2 = parseTimeToMinutes(start2);
  let e2 = parseTimeToMinutes(end2);
  if (e2 <= s2) e2 += 1440;

  return Math.max(s1, s2) < Math.min(e1, e2);
}

/**
 * Formats date into readable Arabic string
 */
export function formatDateArabic(dateStr: string, includeDayName = true): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  const dayOfWeek = date.getDay();
  const dayName = DAY_NAMES_ARABIC[dayOfWeek] || '';
  
  const monthsArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  
  const day = date.getDate();
  const month = monthsArabic[date.getMonth()];
  const year = date.getFullYear();

  if (includeDayName) {
    return `${dayName} ${day} ${month} ${year}`;
  }
  return `${day} ${month} ${year}`;
}

/**
 * Check if a date string falls within [startDate, endDate] inclusive
 */
export function isDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  if (!startDate && !endDate) return true;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/**
 * Check if a week [weekStart, weekEnd] intersects [startDate, endDate]
 */
export function doesWeekIntersectRange(
  weekStart: string,
  weekEnd: string,
  startDate?: string,
  endDate?: string
): boolean {
  if (!startDate && !endDate) return true;
  if (startDate && weekEnd < startDate) return false;
  if (endDate && weekStart > endDate) return false;
  return true;
}
