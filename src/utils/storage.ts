/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AppDatabaseSchema,
  AppSettings,
  BaseScheduleItem,
  SupportScheduleItem,
  DailySessionRecord,
  WeekRecord,
  LiquidationRecord,
  AuditLogEntry,
} from '../types/index.ts';

export const CURRENT_SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'tadween_teaching_sessions_db_v1';
export const BACKUP_STORAGE_KEY = 'tadween_teaching_sessions_db_backup';

export const DEFAULT_SETTINGS: AppSettings = {
  referenceWeeklyHours: 16,
  targetBaseWeeklyHours: 14,
  referenceSessionDurationMinutes: 55,
  weekStartDay: 6, // Saturday
  weekEndDay: 4, // Thursday
  holidayDay: 5, // Friday
  liquidationMethod: 'per_session',
  pricePerSession: 1500, // DZD
  pricePerHour: 1600, // DZD
  currency: 'دج',
  dateFormat: 'YYYY-MM-DD',
  schoolCancellationPolicy: 'waived_as_completed',
  autoSave: true,
};

export const INITIAL_DATABASE: AppDatabaseSchema = {
  version: CURRENT_SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  appName: 'تدوين حصص التدريس',
  settings: DEFAULT_SETTINGS,
  baseSchedule: [],
  supportSchedule: [],
  dailyRecords: [],
  weeks: [],
  liquidations: [],
  auditLogs: [],
};

/**
 * Validate imported database JSON structure
 */
export function validateDatabaseSchema(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'الملف لا يحتوي على كائن JSON صالح.' };
  }

  if (typeof data.version !== 'number' || data.version <= 0) {
    return { isValid: false, error: 'رقم إصدار البيانات مفقود أو غير صالح.' };
  }

  if (!Array.isArray(data.baseSchedule)) {
    return { isValid: false, error: 'جدول الحصص الأساسية غير موجود أو تالف.' };
  }

  if (!Array.isArray(data.dailyRecords)) {
    return { isValid: false, error: 'سجل الحصص اليومية غير موجود أو تالف.' };
  }

  if (!Array.isArray(data.weeks)) {
    return { isValid: false, error: 'سجل الأسابيع غير موجود أو تالف.' };
  }

  if (!data.settings || typeof data.settings !== 'object') {
    return { isValid: false, error: 'إعدادات التطبيق مفقودة أو تالفة.' };
  }

  // Validate records structure
  for (const record of data.dailyRecords) {
    if (!record.id || !record.date || typeof record.scheduledDurationMinutes !== 'number') {
      return { isValid: false, error: `سجل الحصة برقم ${record.id || 'مجهول'} تالف أو تنقصه حقول أساسية.` };
    }
  }

  return { isValid: true };
}

/**
 * Deduplicate records by their unique IDs to prevent accidental duplication
 */
export function deduplicateRecords<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

import { getInitialDemoDatabase } from './seedData.ts';

/**
 * Loads database from local storage, with fallback to initial database
 */
export function loadDatabaseFromLocalStorage(): AppDatabaseSchema {
  if (typeof window === 'undefined') return getInitialDemoDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const demoDb = getInitialDemoDatabase();
      saveDatabaseToLocalStorage(demoDb);
      return demoDb;
    }
    const parsed = JSON.parse(raw);
    const validation = validateDatabaseSchema(parsed);
    if (validation.isValid) {
      // Ensure deduplication
      return {
        ...parsed,
        baseSchedule: deduplicateRecords(parsed.baseSchedule || []),
        supportSchedule: deduplicateRecords(parsed.supportSchedule || []),
        dailyRecords: deduplicateRecords(parsed.dailyRecords || []),
        weeks: deduplicateRecords(parsed.weeks || []),
        liquidations: deduplicateRecords(parsed.liquidations || []),
        auditLogs: deduplicateRecords(parsed.auditLogs || []),
      };
    }
    console.error('Database validation error:', validation.error);
    return getInitialDemoDatabase();
  } catch (err) {
    console.error('Failed to parse database from localStorage:', err);
    return getInitialDemoDatabase();
  }
}

/**
 * Saves database to local storage
 */
export function saveDatabaseToLocalStorage(db: AppDatabaseSchema): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Keep a pre-save backup
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      localStorage.setItem(BACKUP_STORAGE_KEY, previous);
    }

    const cleanDb: AppDatabaseSchema = {
      ...db,
      exportedAt: new Date().toISOString(),
      baseSchedule: deduplicateRecords(db.baseSchedule || []),
      supportSchedule: deduplicateRecords(db.supportSchedule || []),
      dailyRecords: deduplicateRecords(db.dailyRecords || []),
      weeks: deduplicateRecords(db.weeks || []),
      liquidations: deduplicateRecords(db.liquidations || []),
      auditLogs: deduplicateRecords(db.auditLogs || []),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDb));
    return true;
  } catch (err) {
    console.error('Failed to save database to localStorage:', err);
    return false;
  }
}
