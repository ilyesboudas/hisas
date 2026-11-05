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
import { getInitialDemoDatabase } from './seedData.ts';

export const CURRENT_SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'tadween_teaching_sessions_db_v1';
export const BACKUP_STORAGE_KEY = 'tadween_teaching_sessions_db_backup';

export const DEFAULT_SETTINGS: AppSettings = {
  referenceWeeklySessions: 16, // 16 sessions required per week
  targetBaseWeeklySessions: 14, // 14 morning base sessions programmed
  referenceSessionDurationMinutes: 55, // 55 minutes per base session
  surplusSessionDurationMinutes: 60, // 60 minutes per surplus evaluated session
  academicYear: '2026-2027', // الموسم الدراسي الافتراضي
  trainingTargetHours: 16, // الهدف الساعي للتكوينات والتكليفات (16 ساعة = 960 دقيقة)
  referenceWeeklyHours: 16, // legacy alias
  targetBaseWeeklyHours: 14, // legacy alias
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
  backupReminderEnabled: true,
  backupReminderIntervalDays: 7,
  autoSaveDebounceMs: 400,
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
  trainingsAssignments: [],
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

  // Validate trainingsAssignments if present
  if (data.trainingsAssignments !== undefined) {
    if (!Array.isArray(data.trainingsAssignments)) {
      return { isValid: false, error: 'سجل التكوينات والتكليفات تالف أو غير صالح.' };
    }
    for (const item of data.trainingsAssignments) {
      if (!item.id || !item.type || !item.date) {
        return { isValid: false, error: `سجل تكوين/تكليف برقم ${item.id || 'مجهول'} تالف أو تنقصه حقول أساسية.` };
      }
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

/**
 * Ensure database schema is complete, valid, and fully populated with default values
 * so no array or setting is ever undefined.
 */
export function normalizeDatabase(data: any): AppDatabaseSchema {
  if (!data || typeof data !== 'object') {
    return getInitialDemoDatabase();
  }

  const rawSettings = data.settings || {};
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    referenceWeeklySessions:
      rawSettings.referenceWeeklySessions ??
      rawSettings.referenceWeeklyHours ??
      DEFAULT_SETTINGS.referenceWeeklySessions,
    targetBaseWeeklySessions:
      rawSettings.targetBaseWeeklySessions ??
      rawSettings.targetBaseWeeklyHours ??
      DEFAULT_SETTINGS.targetBaseWeeklySessions,
    referenceSessionDurationMinutes:
      rawSettings.referenceSessionDurationMinutes ?? DEFAULT_SETTINGS.referenceSessionDurationMinutes,
    surplusSessionDurationMinutes:
      rawSettings.surplusSessionDurationMinutes ?? DEFAULT_SETTINGS.surplusSessionDurationMinutes,
    academicYear: rawSettings.academicYear || DEFAULT_SETTINGS.academicYear,
    trainingTargetHours: rawSettings.trainingTargetHours ?? DEFAULT_SETTINGS.trainingTargetHours,
    backupReminderEnabled: rawSettings.backupReminderEnabled ?? DEFAULT_SETTINGS.backupReminderEnabled,
    backupReminderIntervalDays: rawSettings.backupReminderIntervalDays ?? DEFAULT_SETTINGS.backupReminderIntervalDays,
    autoSaveDebounceMs: rawSettings.autoSaveDebounceMs ?? DEFAULT_SETTINGS.autoSaveDebounceMs,
    autoSave: rawSettings.autoSave ?? true,
  };

  return {
    version: typeof data.version === 'number' && data.version > 0 ? data.version : CURRENT_SCHEMA_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    appName: typeof data.appName === 'string' ? data.appName : 'تدوين حصص التدريس',
    settings,
    baseSchedule: Array.isArray(data.baseSchedule) ? deduplicateRecords(data.baseSchedule) : [],
    supportSchedule: Array.isArray(data.supportSchedule) ? deduplicateRecords(data.supportSchedule) : [],
    dailyRecords: Array.isArray(data.dailyRecords) ? deduplicateRecords(data.dailyRecords) : [],
    weeks: Array.isArray(data.weeks) ? deduplicateRecords(data.weeks) : [],
    liquidations: Array.isArray(data.liquidations) ? deduplicateRecords(data.liquidations) : [],
    auditLogs: Array.isArray(data.auditLogs) ? deduplicateRecords(data.auditLogs) : [],
    trainingsAssignments: Array.isArray(data.trainingsAssignments)
      ? deduplicateRecords(data.trainingsAssignments)
      : [],
  };
}

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
      return normalizeDatabase(parsed);
    }
    console.warn('Database schema warning in localStorage, normalizing safely:', validation.error);
    return normalizeDatabase(parsed);
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
      trainingsAssignments: deduplicateRecords(db.trainingsAssignments || []),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDb));
    
    // Asynchronously synchronize with IndexedDB for long-term dual persistence
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      import('./indexedDb.ts').then(({ saveToIndexedDB }) => {
        saveToIndexedDB(cleanDb).catch((e) => console.warn('IndexedDB sync notice:', e));
      }).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('Failed to save database to localStorage:', err);
    return false;
  }
}

