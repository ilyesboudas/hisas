/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AppDatabaseSchema,
  AppSettings,
  BaseScheduleItem,
  SupportScheduleItem,
  DailySessionRecord,
  WeekRecord,
  LiquidationRecord,
  AuditLogEntry,
  TrainingAssignment,
  SaveStatus,
} from '../types/index.ts';
import {
  loadDatabaseFromLocalStorage,
  saveDatabaseToLocalStorage,
  normalizeDatabase,
  validateDatabaseSchema,
  deduplicateRecords,
  DEFAULT_SETTINGS,
} from '../utils/storage.ts';
import { autoSaveEngine } from '../utils/autoSaveEngine.ts';
import { loadFromIndexedDB, saveSnapshotToIndexedDB } from '../utils/indexedDb.ts';
import { getSaturdayOfWeek, getThursdayOfWeek } from '../utils/dateUtils.ts';
import { getInitialDemoDatabase } from '../utils/seedData.ts';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  db: AppDatabaseSchema;
  hasUnsavedChanges: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string;
  saveError: string | null;
  toast: ToastMessage | null;
  clearToast: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  saveAll: (notify?: boolean) => boolean;
  retrySave: () => Promise<boolean>;
  flushSave: () => Promise<boolean>;
  scheduleFieldSave: (updater: (prev: AppDatabaseSchema) => AppDatabaseSchema, debounceMs?: number) => void;
  
  // Settings
  updateSettings: (newSettings: AppSettings) => void;

  // Base Schedule
  addBaseScheduleItem: (item: Omit<BaseScheduleItem, 'id' | 'createdAt' | 'updatedAt'>) => BaseScheduleItem;
  updateBaseScheduleItem: (item: BaseScheduleItem) => void;
  deleteBaseScheduleItem: (id: string) => void;

  // Support Schedule
  addSupportScheduleItem: (item: Omit<SupportScheduleItem, 'id' | 'createdAt' | 'updatedAt'>) => SupportScheduleItem;
  updateSupportScheduleItem: (item: SupportScheduleItem) => void;
  deleteSupportScheduleItem: (id: string) => void;

  // Daily Records
  saveDailyRecord: (record: Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => DailySessionRecord;
  batchSaveDailyRecords: (records: (Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string })[]) => void;
  deleteDailyRecord: (id: string) => void;

  // Weeks
  ensureWeekExists: (dateStr: string) => WeekRecord;
  updateWeekStatus: (weekId: string, status: 'unreviewed' | 'in_progress' | 'approved', notes?: string) => void;
  approveWeek: (weekId: string) => boolean;
  reopenWeek: (weekId: string, reason: string) => boolean;

  // Liquidations
  addLiquidation: (liquidation: Omit<LiquidationRecord, 'id' | 'createdAt'>) => LiquidationRecord;
  deleteLiquidation: (id: string) => void;

  // Trainings & Assignments
  addTrainingAssignment: (item: Omit<TrainingAssignment, 'id' | 'createdAt' | 'updatedAt'>) => TrainingAssignment;
  updateTrainingAssignment: (item: TrainingAssignment) => void;
  deleteTrainingAssignment: (id: string) => void;
  selectedAcademicYear: string;
  setSelectedAcademicYear: (year: string) => void;

  // Backup & Restore
  exportJsonBackup: () => void;
  importJsonBackup: (jsonContent: string) => Promise<{ success: boolean; error?: string }>;
  resetToDemoData: () => void;
  clearAllData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Synchronous initialization from localStorage for instant render
  const [db, setDb] = useState<AppDatabaseSchema>(() => loadDatabaseFromLocalStorage());
  
  // Save status states managed via autoSaveEngine
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => autoSaveEngine.getStatus().status);
  const [lastSavedAt, setLastSavedAt] = useState<string>(() => autoSaveEngine.getStatus().lastSavedAt);
  const [saveError, setSaveError] = useState<string | null>(() => autoSaveEngine.getStatus().error);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Subscribe to autoSaveEngine
  useEffect(() => {
    const unsubscribe = autoSaveEngine.subscribe((status, time, err) => {
      setSaveStatus(status);
      setLastSavedAt(time);
      setSaveError(err);
      setHasUnsavedChanges(status === 'saving' || status === 'error');
    });
    return unsubscribe;
  }, []);

  // Hydrate from primary IndexedDB on initial launch if newer or populated
  useEffect(() => {
    let active = true;
    loadFromIndexedDB().then((indexedDbData) => {
      if (!active || !indexedDbData) return;
      const validation = validateDatabaseSchema(indexedDbData);
      if (validation.isValid) {
        const localTime = new Date(db.exportedAt || 0).getTime();
        const idbTime = new Date(indexedDbData.exportedAt || 0).getTime();

        // If IndexedDB has newer or equal valid records, hydrate memory with normalized schema
        if (idbTime >= localTime) {
          setDb(normalizeDatabase(indexedDbData));
        } else {
          // localStorage was newer (e.g. from prior synchronous unload write), persist to IndexedDB now
          autoSaveEngine.schedule(db, 0);
        }
      }
    }).catch((err) => {
      console.warn('Initial IndexedDB hydration check:', err);
    });

    return () => {
      active = false;
    };
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
    });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * Central core mutator: Updates React state and schedules automatic save
   */
  const applyAndAutoSave = useCallback((
    updater: (prev: AppDatabaseSchema) => AppDatabaseSchema,
    immediate = true
  ) => {
    setDb((prev) => {
      const next = updater(prev);
      const debounceMs = immediate ? 0 : (next.settings.autoSaveDebounceMs || 400);
      autoSaveEngine.schedule(next, debounceMs);
      return next;
    });
  }, []);

  /**
   * Helper for input fields with debounced auto-saving (300-500ms)
   */
  const scheduleFieldSave = useCallback((
    updater: (prev: AppDatabaseSchema) => AppDatabaseSchema,
    debounceMs = 400
  ) => {
    setDb((prev) => {
      const next = updater(prev);
      autoSaveEngine.schedule(next, debounceMs);
      return next;
    });
  }, []);

  /**
   * Manual save button handler (flushes all queues immediately)
   */
  const saveAll = useCallback((notify = true): boolean => {
    autoSaveEngine.flush();
    const timeStr = new Date().toLocaleTimeString('ar-DZ');
    setLastSavedAt(timeStr);
    if (notify) {
      showToast('success', `تم تأكيد حفظ جميع التغييرات تلقائيًا (${timeStr})`);
    }
    return true;
  }, [showToast]);

  const retrySave = useCallback((): Promise<boolean> => {
    return autoSaveEngine.retryNow(db);
  }, [db]);

  const flushSave = useCallback((): Promise<boolean> => {
    return autoSaveEngine.flush();
  }, []);

  // Helper to append audit log
  const logAudit = useCallback((
    eventType: AuditLogEntry['eventType'],
    entity: string,
    entityId: string,
    details: string,
    previousValue?: string,
    newValue?: string
  ) => {
    const newEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      eventType,
      entity,
      entityId,
      details,
      previousValue,
      newValue,
    };
    return newEntry;
  }, []);

  // Helper to ensure week object exists
  const ensureWeekExists = useCallback((dateStr: string): WeekRecord => {
    const sat = getSaturdayOfWeek(dateStr);
    const thu = getThursdayOfWeek(sat);
    const weekId = `week_${sat}`;

    const existing = db.weeks.find((w) => w.id === weekId);
    if (existing) return existing;

    const newWeek: WeekRecord = {
      id: weekId,
      startDate: sat,
      endDate: thu,
      status: 'unreviewed',
    };

    applyAndAutoSave((prev) => ({
      ...prev,
      weeks: deduplicateRecords([...prev.weeks, newWeek]),
    }), true);

    return newWeek;
  }, [db.weeks, applyAndAutoSave]);

  // Settings
  const updateSettings = useCallback((newSettings: AppSettings) => {
    const audit = logAudit('update', 'settings', 'app_settings', 'تحديث إعدادات التطبيق');
    applyAndAutoSave((prev) => ({
      ...prev,
      settings: newSettings,
      auditLogs: [audit, ...prev.auditLogs],
    }), true);
    showToast('success', 'تم حفظ الإعدادات تلقائيًا في قاعدة البيانات.');
  }, [logAudit, applyAndAutoSave, showToast]);

  // Base Schedule
  const addBaseScheduleItem = useCallback((
    item: Omit<BaseScheduleItem, 'id' | 'createdAt' | 'updatedAt'>
  ): BaseScheduleItem => {
    const now = new Date().toISOString();
    const newItem: BaseScheduleItem = {
      ...item,
      id: `base_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    const audit = logAudit('create', 'baseSchedule', newItem.id, `إضافة حصة أساسية: ${newItem.subject || ''} (${newItem.durationMinutes} د)`);
    applyAndAutoSave((prev) => ({
      ...prev,
      baseSchedule: deduplicateRecords([...prev.baseSchedule, newItem]),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('success', 'تمت إضافة الحصة الأساسية وحفظها تلقائيًا.');
    return newItem;
  }, [logAudit, applyAndAutoSave, showToast]);

  const updateBaseScheduleItem = useCallback((item: BaseScheduleItem) => {
    const now = new Date().toISOString();
    const updated: BaseScheduleItem = { ...item, updatedAt: now };
    const audit = logAudit('update', 'baseSchedule', item.id, `تعديل الحصة الأساسية: ${item.subject || ''}`);

    applyAndAutoSave((prev) => ({
      ...prev,
      baseSchedule: prev.baseSchedule.map((b) => (b.id === item.id ? updated : b)),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('success', 'تم تحديث الحصة وحفظها تلقائيًا.');
  }, [logAudit, applyAndAutoSave, showToast]);

  const deleteBaseScheduleItem = useCallback((id: string) => {
    const audit = logAudit('delete', 'baseSchedule', id, `حذف الحصة الأساسية رقم ${id}`);
    applyAndAutoSave((prev) => ({
      ...prev,
      baseSchedule: prev.baseSchedule.filter((b) => b.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('info', 'تم حذف الحصة وتحديث قاعدة البيانات تلقائيًا.');
  }, [logAudit, applyAndAutoSave, showToast]);

  // Support Schedule
  const addSupportScheduleItem = useCallback((
    item: Omit<SupportScheduleItem, 'id' | 'createdAt' | 'updatedAt'>
  ): SupportScheduleItem => {
    const now = new Date().toISOString();
    const newItem: SupportScheduleItem = {
      ...item,
      id: `supp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    const audit = logAudit('create', 'supportSchedule', newItem.id, `إضافة حصة دعم ثابتة: ${newItem.subject || ''}`);
    applyAndAutoSave((prev) => ({
      ...prev,
      supportSchedule: deduplicateRecords([...prev.supportSchedule, newItem]),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('success', 'تمت إضافة حصة الدعم وحفظها تلقائيًا.');
    return newItem;
  }, [logAudit, applyAndAutoSave, showToast]);

  const updateSupportScheduleItem = useCallback((item: SupportScheduleItem) => {
    const now = new Date().toISOString();
    const updated: SupportScheduleItem = { ...item, updatedAt: now };
    const audit = logAudit('update', 'supportSchedule', item.id, `تعديل حصة الدعم الثابتة: ${item.subject || ''}`);

    applyAndAutoSave((prev) => ({
      ...prev,
      supportSchedule: prev.supportSchedule.map((s) => (s.id === item.id ? updated : s)),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('success', 'تم تحديث حصة الدعم وحفظها تلقائيًا.');
  }, [logAudit, applyAndAutoSave, showToast]);

  const deleteSupportScheduleItem = useCallback((id: string) => {
    const audit = logAudit('delete', 'supportSchedule', id, `حذف حصة الدعم الثابتة رقم ${id}`);
    applyAndAutoSave((prev) => ({
      ...prev,
      supportSchedule: prev.supportSchedule.filter((s) => s.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('info', 'تم حذف حصة الدعم وحفظ التغيير تلقائيًا.');
  }, [logAudit, applyAndAutoSave, showToast]);

  // Daily Records
  const saveDailyRecord = useCallback((
    recordInput: Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): DailySessionRecord => {
    const now = new Date().toISOString();
    ensureWeekExists(recordInput.date);

    let existingId = recordInput.id;
    if (!existingId) {
      if (recordInput.baseScheduleId) {
        const found = db.dailyRecords.find(
          (r) => r.date === recordInput.date && r.baseScheduleId === recordInput.baseScheduleId
        );
        if (found) existingId = found.id;
      } else if (recordInput.supportScheduleId) {
        const found = db.dailyRecords.find(
          (r) => r.date === recordInput.date && r.supportScheduleId === recordInput.supportScheduleId
        );
        if (found) existingId = found.id;
      }
    }

    const recordId = existingId || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalRecord: DailySessionRecord = {
      ...recordInput,
      id: recordId,
      createdAt: now,
      updatedAt: now,
    };

    applyAndAutoSave((prev) => {
      const filtered = prev.dailyRecords.filter((r) => r.id !== recordId);
      const audit = logAudit(
        existingId ? 'update' : 'create',
        'dailyRecord',
        recordId,
        `تسجيل حصة بتاريخ ${recordInput.date} (${recordInput.subject || recordInput.type}): ${recordInput.status}`
      );
      return {
        ...prev,
        dailyRecords: deduplicateRecords([...filtered, finalRecord]),
        auditLogs: [audit, ...prev.auditLogs],
      };
    }, true);

    return finalRecord;
  }, [db.dailyRecords, ensureWeekExists, logAudit, applyAndAutoSave]);

  const batchSaveDailyRecords = useCallback((
    recordsInput: (Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string })[]
  ) => {
    if (!recordsInput.length) return;
    const now = new Date().toISOString();
    const updatedRecords: DailySessionRecord[] = [];

    for (const r of recordsInput) {
      ensureWeekExists(r.date);
      let existingId = r.id;
      if (!existingId) {
        if (r.baseScheduleId) {
          const found = db.dailyRecords.find((x) => x.date === r.date && x.baseScheduleId === r.baseScheduleId);
          if (found) existingId = found.id;
        } else if (r.supportScheduleId) {
          const found = db.dailyRecords.find((x) => x.date === r.date && x.supportScheduleId === r.supportScheduleId);
          if (found) existingId = found.id;
        }
      }
      const recordId = existingId || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      updatedRecords.push({
        ...r,
        id: recordId,
        createdAt: now,
        updatedAt: now,
      });
    }

    applyAndAutoSave((prev) => {
      const idsToReplace = new Set(updatedRecords.map((x) => x.id));
      const remaining = prev.dailyRecords.filter((x) => !idsToReplace.has(x.id));
      const audit = logAudit('update', 'dailyRecord', 'batch', `تسجيل جماعي لـ ${updatedRecords.length} حصة`);
      return {
        ...prev,
        dailyRecords: deduplicateRecords([...remaining, ...updatedRecords]),
        auditLogs: [audit, ...prev.auditLogs],
      };
    }, true);

    showToast('success', `تم حفظ تسجيلات اليوم تلقائيًا (${updatedRecords.length} حصص).`);
  }, [db.dailyRecords, ensureWeekExists, logAudit, applyAndAutoSave, showToast]);

  const deleteDailyRecord = useCallback((id: string) => {
    const audit = logAudit('delete', 'dailyRecord', id, `حذف تسجيل الحصة رقم ${id}`);
    applyAndAutoSave((prev) => ({
      ...prev,
      dailyRecords: prev.dailyRecords.filter((r) => r.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('info', 'تم حذف التسجيل وحفظ التغيير تلقائيًا.');
  }, [logAudit, applyAndAutoSave, showToast]);

  // Weeks
  const updateWeekStatus = useCallback((
    weekId: string,
    status: 'unreviewed' | 'in_progress' | 'approved',
    notes?: string
  ) => {
    applyAndAutoSave((prev) => {
      const updatedWeeks = prev.weeks.map((w) => {
        if (w.id === weekId) {
          return {
            ...w,
            status,
            notes: notes !== undefined ? notes : w.notes,
            approvalDate: status === 'approved' ? new Date().toISOString() : undefined,
          };
        }
        return w;
      });
      const audit = logAudit('update', 'week', weekId, `تعديل حالة الأسبوع إلى: ${status}`);
      return {
        ...prev,
        weeks: updatedWeeks,
        auditLogs: [audit, ...prev.auditLogs],
      };
    }, true);
  }, [logAudit, applyAndAutoSave]);

  const approveWeek = useCallback((weekId: string): boolean => {
    const week = db.weeks.find((w) => w.id === weekId);
    if (!week) return false;

    const approvalDate = new Date().toISOString();
    applyAndAutoSave((prev) => {
      const updatedWeeks = prev.weeks.map((w) => {
        if (w.id === weekId) {
          return {
            ...w,
            status: 'approved' as const,
            approvalDate,
          };
        }
        return w;
      });
      const audit = logAudit('approve_week', 'week', weekId, `اعتماد الأسبوع [${week.startDate} إلى ${week.endDate}]`);
      return {
        ...prev,
        weeks: updatedWeeks,
        auditLogs: [audit, ...prev.auditLogs],
      };
    }, true);

    showToast('success', `تم اعتماد الأسبوع [${week.startDate} إلى ${week.endDate}] وحفظه تلقائيًا.`);
    return true;
  }, [db.weeks, logAudit, applyAndAutoSave, showToast]);

  const reopenWeek = useCallback((weekId: string, reason: string): boolean => {
    const week = db.weeks.find((w) => w.id === weekId);
    if (!week) return false;

    const reopenedDate = new Date().toISOString();
    applyAndAutoSave((prev) => {
      const updatedWeeks = prev.weeks.map((w) => {
        if (w.id === weekId) {
          return {
            ...w,
            status: 'in_progress' as const,
            reopenedDate,
            reopenReason: reason,
          };
        }
        return w;
      });
      const audit = logAudit(
        'reopen_week',
        'week',
        weekId,
        `إعادة فتح الأسبوع [${week.startDate} إلى ${week.endDate}]. السبب: ${reason}`
      );
      return {
        ...prev,
        weeks: updatedWeeks,
        auditLogs: [audit, ...prev.auditLogs],
      };
    }, true);

    showToast('info', `تمت إعادة فتح الأسبوع [${week.startDate} إلى ${week.endDate}] للتصحيح وحفظ التغيير تلقائيًا.`);
    return true;
  }, [db.weeks, logAudit, applyAndAutoSave, showToast]);

  // Liquidations
  const addLiquidation = useCallback((
    liquidationInput: Omit<LiquidationRecord, 'id' | 'createdAt'>
  ): LiquidationRecord => {
    const now = new Date().toISOString();
    const newLiq: LiquidationRecord = {
      ...liquidationInput,
      id: `liq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      approvedAt: liquidationInput.status === 'approved' ? now : undefined,
    };

    const audit = logAudit(
      'approve_liquidation',
      'liquidation',
      newLiq.id,
      `اعتماد تصفية مالية للفترة [${newLiq.startDate} إلى ${newLiq.endDate}]: ${newLiq.snapshot.financialAmount} ${db.settings.currency}`
    );

    applyAndAutoSave((prev) => ({
      ...prev,
      liquidations: deduplicateRecords([newLiq, ...prev.liquidations]),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('success', 'تم اعتماد التصفية وحفظها تلقائيًا في الأرشيف.');
    return newLiq;
  }, [db.settings.currency, logAudit, applyAndAutoSave, showToast]);

  const deleteLiquidation = useCallback((id: string) => {
    const audit = logAudit('delete', 'liquidation', id, `حذف التصفية رقم ${id}`);
    applyAndAutoSave((prev) => ({
      ...prev,
      liquidations: prev.liquidations.filter((l) => l.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }), true);

    showToast('info', 'تم حذف التصفية وحفظ التغيير تلقائيًا.');
  }, [logAudit, applyAndAutoSave, showToast]);

  // Selected Academic Year
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    () => db.settings.academicYear || '2026-2027'
  );

  useEffect(() => {
    if (db.settings.academicYear && !selectedAcademicYear) {
      setSelectedAcademicYear(db.settings.academicYear);
    }
  }, [db.settings.academicYear, selectedAcademicYear]);

  // Trainings & Assignments CRUD
  const addTrainingAssignment = useCallback(
    (item: Omit<TrainingAssignment, 'id' | 'createdAt' | 'updatedAt'>): TrainingAssignment => {
      const now = new Date().toISOString();
      const newActivity: TrainingAssignment = {
        ...item,
        id: `train_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const audit = logAudit(
        'create',
        'training_assignment',
        newActivity.id,
        `إضافة ${newActivity.type === 'training' ? 'تكوين' : 'تكليف'}: ${newActivity.title || 'بدون عنوان'} (${newActivity.durationMinutes} دقيقة) [${newActivity.academicYear}]`
      );

      applyAndAutoSave((prev) => ({
        ...prev,
        trainingsAssignments: deduplicateRecords([newActivity, ...(prev.trainingsAssignments || [])]),
        auditLogs: [audit, ...prev.auditLogs],
      }), true);

      showToast('success', `تم حفظ ${newActivity.type === 'training' ? 'التكوين' : 'التكليف'} تلقائيًا.`);
      return newActivity;
    },
    [logAudit, applyAndAutoSave, showToast]
  );

  const updateTrainingAssignment = useCallback(
    (item: TrainingAssignment) => {
      const now = new Date().toISOString();
      const updated: TrainingAssignment = {
        ...item,
        updatedAt: now,
      };

      const audit = logAudit(
        'update',
        'training_assignment',
        item.id,
        `تعديل ${item.type === 'training' ? 'تكوين' : 'تكليف'}: ${item.title || 'بدون عنوان'} (${item.durationMinutes} دقيقة)`
      );

      applyAndAutoSave((prev) => ({
        ...prev,
        trainingsAssignments: (prev.trainingsAssignments || []).map((t) => (t.id === item.id ? updated : t)),
        auditLogs: [audit, ...prev.auditLogs],
      }), true);

      showToast('success', 'تم تعديل النشاط وحفظه تلقائيًا.');
    },
    [logAudit, applyAndAutoSave, showToast]
  );

  const deleteTrainingAssignment = useCallback(
    (id: string) => {
      const target = (db.trainingsAssignments || []).find((t) => t.id === id);
      const audit = logAudit(
        'delete',
        'training_assignment',
        id,
        `حذف ${target?.type === 'training' ? 'تكوين' : 'تكليف'} رقم ${id}`
      );

      applyAndAutoSave((prev) => ({
        ...prev,
        trainingsAssignments: (prev.trainingsAssignments || []).filter((t) => t.id !== id),
        auditLogs: [audit, ...prev.auditLogs],
      }), true);

      showToast('info', 'تم حذف النشاط وتحديث قاعدة البيانات تلقائيًا.');
    },
    [db.trainingsAssignments, logAudit, applyAndAutoSave, showToast]
  );

  // Backup & Restore
  const exportJsonBackup = useCallback(() => {
    try {
      const nowIso = new Date().toISOString();
      
      // Update lastBackupDate in settings
      const updatedSettings: AppSettings = {
        ...db.settings,
        lastBackupDate: nowIso,
      };

      const dataToExport: AppDatabaseSchema = {
        ...db,
        settings: updatedSettings,
        exportedAt: nowIso,
      };

      // Save updated settings with lastBackupDate
      applyAndAutoSave((prev) => ({
        ...prev,
        settings: updatedSettings,
      }), true);

      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateTag = nowIso.split('T')[0];
      link.href = url;
      link.download = `tadween_teaching_backup_${dateTag}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('success', 'تم تنزيل النسخة الاحتياطية وتحديث تاريخ النسخ بنجاح.');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('error', 'حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    }
  }, [db, applyAndAutoSave, showToast]);

  const importJsonBackup = useCallback(async (
    jsonContent: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const parsed = JSON.parse(jsonContent);
      const validation = validateDatabaseSchema(parsed);
      if (!validation.isValid) {
        return { success: false, error: validation.error || 'الملف تالف وغير متوافق مع بنية البيانات.' };
      }

      // Save a local snapshot of current db before importing
      await saveSnapshotToIndexedDB(db, 'نقطة استعادة احترازية قبل استيراد ملف JSON');

      const restored: AppDatabaseSchema = {
        ...parsed,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
          academicYear: parsed.settings?.academicYear || '2026-2027',
          trainingTargetHours: parsed.settings?.trainingTargetHours || 16,
        },
        baseSchedule: deduplicateRecords(parsed.baseSchedule || []),
        supportSchedule: deduplicateRecords(parsed.supportSchedule || []),
        dailyRecords: deduplicateRecords(parsed.dailyRecords || []),
        weeks: deduplicateRecords(parsed.weeks || []),
        liquidations: deduplicateRecords(parsed.liquidations || []),
        trainingsAssignments: deduplicateRecords(parsed.trainingsAssignments || []),
        auditLogs: deduplicateRecords([
          logAudit('restore_backup', 'system', 'import', 'استعادة نسخة احتياطية من ملف JSON'),
          ...(parsed.auditLogs || []),
        ]),
      };

      setDb(restored);
      autoSaveEngine.schedule(restored, 0);
      showToast('success', 'تمت استعادة البيانات وحفظها تلقائيًا بنجاح.');
      return { success: true };
    } catch (err: any) {
      console.error('Import error:', err);
      return { success: false, error: 'الملف غير صالح أو لا يحتوي على بنية JSON صحيحة.' };
    }
  }, [db, logAudit, showToast]);

  const resetToDemoData = useCallback(async () => {
    // Take safety snapshot before reset
    await saveSnapshotToIndexedDB(db, 'نقطة استعادة قبل استعادة البيانات النموذجية');
    const demo = getInitialDemoDatabase();
    setDb(demo);
    autoSaveEngine.schedule(demo, 0);
    showToast('info', 'تمت استعادة البيانات النموذجية وحفظها تلقائيًا.');
  }, [db, showToast]);

  const clearAllData = useCallback(async () => {
    // Take safety snapshot before clear
    await saveSnapshotToIndexedDB(db, 'نقطة استعادة قبل مسح البيانات');
    const emptyDb: AppDatabaseSchema = {
      version: 1,
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
    setDb(emptyDb);
    autoSaveEngine.schedule(emptyDb, 0);
    showToast('info', 'تم مسح جميع البيانات وحفظ الحالة الفارغة تلقائيًا.');
  }, [db, showToast]);

  return (
    <AppContext.Provider
      value={{
        db,
        hasUnsavedChanges,
        saveStatus,
        lastSavedAt,
        saveError,
        toast,
        clearToast,
        showToast,
        saveAll,
        retrySave,
        flushSave,
        scheduleFieldSave,
        updateSettings,
        addBaseScheduleItem,
        updateBaseScheduleItem,
        deleteBaseScheduleItem,
        addSupportScheduleItem,
        updateSupportScheduleItem,
        deleteSupportScheduleItem,
        saveDailyRecord,
        batchSaveDailyRecords,
        deleteDailyRecord,
        ensureWeekExists,
        updateWeekStatus,
        approveWeek,
        reopenWeek,
        addLiquidation,
        deleteLiquidation,
        addTrainingAssignment,
        updateTrainingAssignment,
        deleteTrainingAssignment,
        selectedAcademicYear,
        setSelectedAcademicYear,
        exportJsonBackup,
        importJsonBackup,
        resetToDemoData,
        clearAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
