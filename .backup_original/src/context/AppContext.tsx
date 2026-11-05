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
} from '../types/index.ts';
import {
  loadDatabaseFromLocalStorage,
  saveDatabaseToLocalStorage,
  validateDatabaseSchema,
  deduplicateRecords,
  DEFAULT_SETTINGS,
} from '../utils/storage.ts';
import { getSaturdayOfWeek, getThursdayOfWeek, getWeekIdForDate } from '../utils/dateUtils.ts';
import { getInitialDemoDatabase } from '../utils/seedData.ts';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  db: AppDatabaseSchema;
  hasUnsavedChanges: boolean;
  lastSavedAt: string;
  toast: ToastMessage | null;
  clearToast: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  saveAll: (notify?: boolean) => boolean;
  
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

  // Backup & Restore
  exportJsonBackup: () => void;
  importJsonBackup: (jsonContent: string) => { success: boolean; error?: string };
  resetToDemoData: () => void;
  clearAllData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabaseSchema>(() => loadDatabaseFromLocalStorage());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>(() => new Date().toLocaleTimeString('ar-DZ'));
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  // Save all to localStorage
  const saveAll = useCallback((notify = true): boolean => {
    const success = saveDatabaseToLocalStorage(db);
    if (success) {
      setHasUnsavedChanges(false);
      const timeStr = new Date().toLocaleTimeString('ar-DZ');
      setLastSavedAt(timeStr);
      if (notify) {
        showToast('success', `تم حفظ جميع التغييرات بنجاح (${timeStr})`);
      }
      return true;
    } else {
      if (notify) {
        showToast('error', 'تعذر حفظ البيانات في الذاكرة المحلية للمتصفح.');
      }
      return false;
    }
  }, [db, showToast]);

  // Auto-save effect if enabled
  useEffect(() => {
    if (hasUnsavedChanges && db.settings.autoSave) {
      const timer = setTimeout(() => {
        saveAll(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, db, saveAll]);

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

    setDb((prev) => ({
      ...prev,
      weeks: deduplicateRecords([...prev.weeks, newWeek]),
    }));
    setHasUnsavedChanges(true);
    return newWeek;
  }, [db.weeks]);

  // Settings
  const updateSettings = useCallback((newSettings: AppSettings) => {
    const audit = logAudit('update', 'settings', 'app_settings', 'تحديث إعدادات التطبيق');
    setDb((prev) => ({
      ...prev,
      settings: newSettings,
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('success', 'تم تحديث الإعدادات بنجاح.');
  }, [logAudit, showToast]);

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
    setDb((prev) => ({
      ...prev,
      baseSchedule: deduplicateRecords([...prev.baseSchedule, newItem]),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('success', 'تمت إضافة الحصة الأساسية إلى الجدول.');
    return newItem;
  }, [logAudit, showToast]);

  const updateBaseScheduleItem = useCallback((item: BaseScheduleItem) => {
    const now = new Date().toISOString();
    const updated: BaseScheduleItem = { ...item, updatedAt: now };
    const audit = logAudit('update', 'baseSchedule', item.id, `تعديل الحصة الأساسية: ${item.subject || ''}`);

    setDb((prev) => ({
      ...prev,
      baseSchedule: prev.baseSchedule.map((b) => (b.id === item.id ? updated : b)),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('success', 'تم تحديث الحصة الأساسية.');
  }, [logAudit, showToast]);

  const deleteBaseScheduleItem = useCallback((id: string) => {
    const audit = logAudit('delete', 'baseSchedule', id, `حذف الحصة الأساسية رقم ${id}`);
    setDb((prev) => ({
      ...prev,
      baseSchedule: prev.baseSchedule.filter((b) => b.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('info', 'تم حذف الحصة من الجدول الأساسي.');
  }, [logAudit, showToast]);

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
    setDb((prev) => ({
      ...prev,
      supportSchedule: deduplicateRecords([...prev.supportSchedule, newItem]),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('success', 'تمت إضافة حصة الدعم الثابتة.');
    return newItem;
  }, [logAudit, showToast]);

  const updateSupportScheduleItem = useCallback((item: SupportScheduleItem) => {
    const now = new Date().toISOString();
    const updated: SupportScheduleItem = { ...item, updatedAt: now };
    const audit = logAudit('update', 'supportSchedule', item.id, `تعديل حصة الدعم الثابتة: ${item.subject || ''}`);

    setDb((prev) => ({
      ...prev,
      supportSchedule: prev.supportSchedule.map((s) => (s.id === item.id ? updated : s)),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('success', 'تم تحديث حصة الدعم الثابتة.');
  }, [logAudit, showToast]);

  const deleteSupportScheduleItem = useCallback((id: string) => {
    const audit = logAudit('delete', 'supportSchedule', id, `حذف حصة الدعم الثابتة رقم ${id}`);
    setDb((prev) => ({
      ...prev,
      supportSchedule: prev.supportSchedule.filter((s) => s.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('info', 'تم حذف حصة الدعم الثابتة.');
  }, [logAudit, showToast]);

  // Daily Records
  const saveDailyRecord = useCallback((
    recordInput: Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): DailySessionRecord => {
    const now = new Date().toISOString();
    ensureWeekExists(recordInput.date);

    let existingId = recordInput.id;
    if (!existingId) {
      // Check if duplicate exists for the same date and schedule item
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

    setDb((prev) => {
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
    });

    setHasUnsavedChanges(true);
    return finalRecord;
  }, [db.dailyRecords, ensureWeekExists, logAudit]);

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

    setDb((prev) => {
      const idsToReplace = new Set(updatedRecords.map((x) => x.id));
      const remaining = prev.dailyRecords.filter((x) => !idsToReplace.has(x.id));
      const audit = logAudit('update', 'dailyRecord', 'batch', `تسجيل جماعي لـ ${updatedRecords.length} حصة`);
      return {
        ...prev,
        dailyRecords: deduplicateRecords([...remaining, ...updatedRecords]),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    setHasUnsavedChanges(true);
    showToast('success', `تم حفظ تسجيلات اليوم (${updatedRecords.length} حصص).`);
  }, [db.dailyRecords, ensureWeekExists, logAudit, showToast]);

  const deleteDailyRecord = useCallback((id: string) => {
    const audit = logAudit('delete', 'dailyRecord', id, `حذف تسجيل الحصة رقم ${id}`);
    setDb((prev) => ({
      ...prev,
      dailyRecords: prev.dailyRecords.filter((r) => r.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('info', 'تم حذف تسجيل الحصة.');
  }, [logAudit, showToast]);

  // Weeks
  const updateWeekStatus = useCallback((
    weekId: string,
    status: 'unreviewed' | 'in_progress' | 'approved',
    notes?: string
  ) => {
    setDb((prev) => {
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
    });
    setHasUnsavedChanges(true);
  }, [logAudit]);

  const approveWeek = useCallback((weekId: string): boolean => {
    const week = db.weeks.find((w) => w.id === weekId);
    if (!week) return false;

    const approvalDate = new Date().toISOString();
    setDb((prev) => {
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
    });

    setHasUnsavedChanges(true);
    showToast('success', `تم اعتماد الأسبوع [${week.startDate} إلى ${week.endDate}] بنجاح.`);
    return true;
  }, [db.weeks, logAudit, showToast]);

  const reopenWeek = useCallback((weekId: string, reason: string): boolean => {
    const week = db.weeks.find((w) => w.id === weekId);
    if (!week) return false;

    const reopenedDate = new Date().toISOString();
    setDb((prev) => {
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
    });

    setHasUnsavedChanges(true);
    showToast('info', `تمت إعادة فتح الأسبوع [${week.startDate} إلى ${week.endDate}] للتصحيح.`);
    return true;
  }, [db.weeks, logAudit, showToast]);

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

    setDb((prev) => ({
      ...prev,
      liquidations: deduplicateRecords([newLiq, ...prev.liquidations]),
      auditLogs: [audit, ...prev.auditLogs],
    }));

    setHasUnsavedChanges(true);
    showToast('success', 'تم اعتماد التصفية وحفظها في الأرشيف.');
    return newLiq;
  }, [db.settings.currency, logAudit, showToast]);

  const deleteLiquidation = useCallback((id: string) => {
    const audit = logAudit('delete', 'liquidation', id, `حذف التصفية رقم ${id}`);
    setDb((prev) => ({
      ...prev,
      liquidations: prev.liquidations.filter((l) => l.id !== id),
      auditLogs: [audit, ...prev.auditLogs],
    }));
    setHasUnsavedChanges(true);
    showToast('info', 'تم حذف التصفية من الأرشيف.');
  }, [logAudit, showToast]);

  // Backup & Restore
  const exportJsonBackup = useCallback(() => {
    try {
      const dataToExport: AppDatabaseSchema = {
        ...db,
        exportedAt: new Date().toISOString(),
      };
      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateTag = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `tadween_teaching_backup_${dateTag}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('success', 'تم تنزيل النسخة الاحتياطية بنجاح.');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('error', 'حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    }
  }, [db, showToast]);

  const importJsonBackup = useCallback((jsonContent: string): { success: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(jsonContent);
      const validation = validateDatabaseSchema(parsed);
      if (!validation.isValid) {
        return { success: false, error: validation.error || 'الملف تالف وغير متوافق مع بنية البيانات.' };
      }

      // Pre-save backup of current db
      saveDatabaseToLocalStorage(db);

      const restored: AppDatabaseSchema = {
        ...parsed,
        baseSchedule: deduplicateRecords(parsed.baseSchedule || []),
        supportSchedule: deduplicateRecords(parsed.supportSchedule || []),
        dailyRecords: deduplicateRecords(parsed.dailyRecords || []),
        weeks: deduplicateRecords(parsed.weeks || []),
        liquidations: deduplicateRecords(parsed.liquidations || []),
        auditLogs: deduplicateRecords([
          logAudit('restore_backup', 'system', 'import', 'استعادة نسخة احتياطية من ملف JSON'),
          ...(parsed.auditLogs || []),
        ]),
      };

      setDb(restored);
      saveDatabaseToLocalStorage(restored);
      setHasUnsavedChanges(false);
      showToast('success', 'تمت استعادة البيانات بنجاح من النسخة الاحتياطية.');
      return { success: true };
    } catch (err: any) {
      console.error('Import error:', err);
      return { success: false, error: 'الملف غير صالح أو لا يحتوي على بنية JSON صحيحة.' };
    }
  }, [db, logAudit, showToast]);

  const resetToDemoData = useCallback(() => {
    const demo = getInitialDemoDatabase();
    setDb(demo);
    saveDatabaseToLocalStorage(demo);
    setHasUnsavedChanges(false);
    showToast('info', 'تمت استعادة البيانات النموذجية.');
  }, [showToast]);

  const clearAllData = useCallback(() => {
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
    };
    setDb(emptyDb);
    saveDatabaseToLocalStorage(emptyDb);
    setHasUnsavedChanges(false);
    showToast('info', 'تم مسح جميع البيانات.');
  }, [showToast]);

  return (
    <AppContext.Provider
      value={{
        db,
        hasUnsavedChanges,
        lastSavedAt,
        toast,
        clearToast,
        showToast,
        saveAll,
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
