/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// Set up globals BEFORE importing project modules
class MockLocalStorage {
  public store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: ((ev?: any) => void) | null = null;
  onerror: ((ev?: any) => void) | null = null;
}

class MockIDBTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: any = null;
  private pendingCount = 0;
  private hasError = false;

  constructor(private storeMap: Map<string, any>, private shouldFail = false) {}

  private checkDone() {
    if (this.pendingCount === 0) {
      setTimeout(() => {
        if (this.pendingCount === 0) {
          if (this.hasError) {
            if (this.onerror) this.onerror();
          } else {
            if (this.oncomplete) this.oncomplete();
          }
        }
      }, 0);
    }
  }

  objectStore(name: string) {
    return {
      put: (val: any, key: string) => {
        const req = new MockIDBRequest();
        this.pendingCount++;
        setTimeout(() => {
          this.pendingCount--;
          if (this.shouldFail) {
            this.hasError = true;
            req.error = new Error('Simulated IndexedDB disk failure');
            this.error = req.error;
            if (req.onerror) req.onerror();
          } else {
            this.storeMap.set(key, JSON.parse(JSON.stringify(val)));
            req.result = key;
            if (req.onsuccess) req.onsuccess();
          }
          this.checkDone();
        }, 5);
        return req;
      },
      get: (key: string) => {
        const req = new MockIDBRequest();
        this.pendingCount++;
        setTimeout(() => {
          this.pendingCount--;
          const item = this.storeMap.get(key);
          req.result = item !== undefined ? JSON.parse(JSON.stringify(item)) : undefined;
          if (req.onsuccess) req.onsuccess();
          this.checkDone();
        }, 5);
        return req;
      },
      delete: (key: string) => {
        const req = new MockIDBRequest();
        this.pendingCount++;
        setTimeout(() => {
          this.pendingCount--;
          this.storeMap.delete(key);
          if (req.onsuccess) req.onsuccess();
          this.checkDone();
        }, 5);
        return req;
      },
      getAll: () => {
        const req = new MockIDBRequest();
        this.pendingCount++;
        setTimeout(() => {
          this.pendingCount--;
          req.result = Array.from(this.storeMap.values());
          if (req.onsuccess) req.onsuccess();
          this.checkDone();
        }, 5);
        return req;
      },
    };
  }
}

class MockIDBDatabase {
  objectStoreNames = {
    contains: (name: string) => true,
  };
  public shouldFailNext = false;

  constructor(private storage: Map<string, any>) {}

  transaction(stores: string | string[], mode: string) {
    const fail = this.shouldFailNext;
    this.shouldFailNext = false;
    return new MockIDBTransaction(this.storage, fail);
  }

  createObjectStore(name: string) {}
}

const globalMockIDBStorage = new Map<string, any>();
const mockIDBDatabaseInstance = new MockIDBDatabase(globalMockIDBStorage);

const mockIndexedDB = {
  open: (name: string, version: number) => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = mockIDBDatabaseInstance;
      if (req.onsuccess) req.onsuccess();
    }, 5);
    return req;
  },
};

const mockLocalStorageInstance = new MockLocalStorage();

// Assign globals before dynamic imports
(global as any).window = {
  localStorage: mockLocalStorageInstance,
  indexedDB: mockIndexedDB,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(global as any).localStorage = mockLocalStorageInstance;
(global as any).indexedDB = mockIndexedDB;
(global as any).document = {
  visibilityState: 'visible',
  addEventListener: () => {},
  removeEventListener: () => {},
};

describe('اختبارات نظام الحفظ التلقائي الفوري والتخزين المحلي الموثوق (Auto-Save & IndexedDB)', () => {
  let saveDatabaseToLocalStorage: any;
  let loadDatabaseFromLocalStorage: any;
  let DEFAULT_SETTINGS: any;
  let saveToIndexedDB: any;
  let loadFromIndexedDB: any;
  let autoSaveEngine: any;
  let APP_VERSION: any;

  before(async () => {
    mockLocalStorageInstance.clear();
    globalMockIDBStorage.clear();

    const storageMod = await import('../src/utils/storage.ts');
    saveDatabaseToLocalStorage = storageMod.saveDatabaseToLocalStorage;
    loadDatabaseFromLocalStorage = storageMod.loadDatabaseFromLocalStorage;
    DEFAULT_SETTINGS = storageMod.DEFAULT_SETTINGS;

    const idbMod = await import('../src/utils/indexedDb.ts');
    saveToIndexedDB = idbMod.saveToIndexedDB;
    loadFromIndexedDB = idbMod.loadFromIndexedDB;

    const engineMod = await import('../src/utils/autoSaveEngine.ts');
    autoSaveEngine = engineMod.autoSaveEngine;

    const versionMod = await import('../src/utils/version.ts');
    APP_VERSION = versionMod.APP_VERSION;
  });

  test('الحالة 1: إضافة حصة أساسية وحفظها تلقائيًا ثم استعادتها بعد المحاكاة لإعادة فتح التطبيق', async () => {
    const baseDb = {
      version: 1,
      appName: 'تدوين حصص التدريس',
      exportedAt: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
      baseSchedule: [
        {
          id: 'base_sat_01',
          dayOfWeek: 6,
          startTime: '08:00',
          endTime: '08:55',
          durationMinutes: 55,
          subject: 'الرياضيات',
          gradeClass: '3 ع ت',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      supportSchedule: [],
      dailyRecords: [],
      weeks: [],
      liquidations: [],
      auditLogs: [],
      trainingsAssignments: [],
    };

    // Auto-save schedule immediately
    autoSaveEngine.schedule(baseDb, 0);
    const saved = await autoSaveEngine.flush();
    assert.equal(saved, true, 'يجب أن يكتمل الحفظ بنجاح');

    // Simulate closing and reopening: load directly from localStorage and IndexedDB
    const reloadedLocal = loadDatabaseFromLocalStorage();
    assert.equal(reloadedLocal.baseSchedule.length, 1, 'يجب أن تظل الحصة محفوظة في الذاكرة المحلية');
    assert.equal(reloadedLocal.baseSchedule[0].subject, 'الرياضيات');

    const reloadedIDB = await loadFromIndexedDB();
    assert.ok(reloadedIDB, 'يجب أن توجد البيانات في IndexedDB');
    assert.equal(reloadedIDB?.baseSchedule.length, 1);
    assert.equal(reloadedIDB?.baseSchedule[0].id, 'base_sat_01');
  });

  test('الحالة 2: تعديل تسجيل حضور ثم الانتقال الفوري لصفحة أخرى وحفظ التعديلات دون فقدان', async () => {
    const initialDb = loadDatabaseFromLocalStorage();
    const updatedRecord = {
      id: 'rec_2026_11_07_01',
      date: '2026-11-07',
      type: 'base',
      baseScheduleId: 'base_sat_01',
      subject: 'الرياضيات',
      scheduledStartTime: '08:00',
      scheduledEndTime: '08:55',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 45,
      status: 'late',
      delayMinutes: 10,
      notes: 'تأخر مبرر 10 دقائق',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextDb = {
      ...initialDb,
      dailyRecords: [updatedRecord],
    };

    // Schedule auto-save
    autoSaveEngine.schedule(nextDb, 0);

    // Simulate instant page navigation which triggers flush
    const flushResult = await autoSaveEngine.flush();
    assert.equal(flushResult, true);

    const checkDb = await loadFromIndexedDB();
    assert.equal(checkDb?.dailyRecords.length, 1);
    assert.equal(checkDb?.dailyRecords[0].status, 'late');
    assert.equal(checkDb?.dailyRecords[0].delayMinutes, 10);
    assert.equal(checkDb?.dailyRecords[0].notes, 'تأخر مبرر 10 دقائق');
  });

  test('الحالة 3: إدخال بيانات في حقل ثم إغلاق النافذة (Debounced autosave + sync emergency flush)', async () => {
    const current = loadDatabaseFromLocalStorage();
    const modifiedWithDraftNotes = {
      ...current,
      settings: {
        ...current.settings,
        academicYear: '2026-2027 (معدل تلقائيًا)',
      },
    };

    // Simulate typing: schedule with 400ms debounce
    autoSaveEngine.schedule(modifiedWithDraftNotes, 400);

    // Verify engine enters saving status
    const statusBefore = autoSaveEngine.getStatus();
    assert.equal(statusBefore.status, 'saving', 'يجب أن يدخل المحرك في حالة جارٍ الحفظ أثناء المهلة');

    // User closes browser tab immediately -> triggers flushSync
    autoSaveEngine.flushSync();

    // Verify that emergency sync flush saved data into localStorage
    const savedAfterUnload = loadDatabaseFromLocalStorage();
    assert.equal(savedAfterUnload.settings.academicYear, '2026-2027 (معدل تلقائيًا)');
  });

  test('الحالة 4: العمل دون إنترنت وإعادة فتح التطبيق محليًا (100% Offline Capability)', async () => {
    const offlineDb = {
      ...loadDatabaseFromLocalStorage(),
      trainingsAssignments: [
        {
          id: 'train_offline_01',
          type: 'training',
          title: 'تكوين بيداغوجي محلي',
          date: '2026-11-05',
          durationMinutes: 120,
          status: 'completed',
          academicYear: '2026-2027',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    autoSaveEngine.schedule(offlineDb, 0);
    await autoSaveEngine.flush();

    // Reload from storage
    const idbLoaded = await loadFromIndexedDB();
    assert.ok(idbLoaded);
    assert.equal(idbLoaded.trainingsAssignments.length, 1);
    assert.equal(idbLoaded.trainingsAssignments[0].title, 'تكوين بيداغوجي محلي');
    assert.equal(idbLoaded.trainingsAssignments[0].durationMinutes, 120);
  });

  test('الحالة 5: حدوث خطأ مؤقت في التخزين ثم نجاح إعادة المحاولة التلقائية واليدوية', async () => {
    const targetDb = {
      ...loadDatabaseFromLocalStorage(),
      weeks: [
        {
          id: 'week_test_retry',
          startDate: '2026-11-07',
          endDate: '2026-11-12',
          status: 'in_progress',
        },
      ],
    };

    // Instruct mock database to fail the next transaction
    mockIDBDatabaseInstance.shouldFailNext = true;

    autoSaveEngine.schedule(targetDb, 0);
    const firstResult = await autoSaveEngine.flush();
    assert.equal(firstResult, false, 'يجب أن يعيد false عند فشل المعاملة');

    // Engine should report error status
    const errStatus = autoSaveEngine.getStatus();
    assert.equal(errStatus.status, 'error', 'يجب أن يتحول المؤشر إلى حالة تعذر الحفظ');
    assert.ok(errStatus.error?.includes('IndexedDB') || errStatus.error?.length);

    // Now storage heals, trigger retryNow
    const retryResult = await autoSaveEngine.retryNow(targetDb);
    assert.equal(retryResult, true, 'يجب أن تنجح إعادة المحاولة بعد زوال الخطأ المؤقت');

    const healedStatus = autoSaveEngine.getStatus();
    assert.equal(healedStatus.status, 'saved', 'يجب أن يعود المؤشر إلى حالة تم الحفظ تلقائيًا');
  });

  test('الحالة 6: تحديث إصدار التطبيق (v1.4.0) مع وجود بيانات مسبقة والحفاظ التام عليها', async () => {
    const existingBeforeUpdate = await loadFromIndexedDB();
    assert.ok(existingBeforeUpdate);
    assert.ok(existingBeforeUpdate.baseSchedule.length >= 1);

    // Verify APP_VERSION is 1.4.0
    assert.equal(APP_VERSION, '1.4.0');

    // Simulate app update reload: load stored data
    const loadedAfterVersionCheck = loadDatabaseFromLocalStorage();
    assert.equal(loadedAfterVersionCheck.baseSchedule[0].subject, 'الرياضيات');
    assert.equal(loadedAfterVersionCheck.trainingsAssignments.length, 1);
    assert.equal(loadedAfterVersionCheck.settings.autoSave, true);
  });

  test('الحالة 7: الحماية من التضارب والتغييرات المتزامنة (Concurrency Queue Serialization)', async () => {
    const base = loadDatabaseFromLocalStorage();
    const calls: Promise<boolean>[] = [];

    // Rapid successive mutations
    for (let i = 1; i <= 3; i++) {
      const mut = {
        ...base,
        dailyRecords: [
          ...base.dailyRecords,
          {
            id: `concurrent_rec_${i}`,
            date: '2026-11-08',
            type: 'irregular_extra',
            scheduledDurationMinutes: 60,
            actualDurationMinutes: 60,
            status: 'present',
            delayMinutes: 0,
            notes: `حصة متزامنة رقم ${i}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      autoSaveEngine.schedule(mut, 0);
      calls.push(autoSaveEngine.flush());
    }

    const results = await Promise.all(calls);
    for (const r of results) {
      assert.equal(r, true);
    }

    const finalState = await loadFromIndexedDB();
    assert.ok(finalState);
    assert.ok(finalState.dailyRecords.length >= 1);
  });
});
