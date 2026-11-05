/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppDatabaseSchema, SaveStatus } from '../types/index.ts';
import { saveDatabaseToLocalStorage, deduplicateRecords } from './storage.ts';
import { saveToIndexedDB, isIndexedDBAvailable } from './indexedDb.ts';

export type AutoSaveListener = (
  status: SaveStatus,
  lastSavedAt: string,
  error: string | null
) => void;

class AutoSaveEngine {
  private currentStatus: SaveStatus = 'saved';
  private lastSavedTime: string = new Date().toLocaleTimeString('ar-DZ');
  private lastError: string | null = null;
  private pendingDb: AppDatabaseSchema | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<AutoSaveListener> = new Set();
  private savePromiseChain: Promise<boolean> = Promise.resolve(true);
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempts: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.setupLifecycleHooks();
  }

  /**
   * Subscribe to status and timestamp changes
   */
  public subscribe(listener: AutoSaveListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus, this.lastSavedTime, this.lastError);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus, this.lastSavedTime, this.lastError);
      } catch (err) {
        console.error('AutoSave listener error:', err);
      }
    }
  }

  public getStatus(): { status: SaveStatus; lastSavedAt: string; error: string | null } {
    return {
      status: this.currentStatus,
      lastSavedAt: this.lastSavedTime,
      error: this.lastError,
    };
  }

  /**
   * Schedule an auto-save operation.
   * If debounceMs <= 0, saves immediately.
   * Otherwise waits debounceMs (default 400ms) after the last update.
   */
  public schedule(db: AppDatabaseSchema, debounceMs: number = 400): void {
    this.pendingDb = db;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (debounceMs <= 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.flush();
      return;
    }

    // Set status to saving indicator
    if (this.currentStatus !== 'saving') {
      this.currentStatus = 'saving';
      this.notify();
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flush();
    }, debounceMs);
  }

  /**
   * Immediately flush any pending save through the serialized queue
   */
  public flush(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!this.pendingDb) {
      // Nothing new pending: wait for in-flight save to complete
      return this.savePromiseChain;
    }

    const dbToSave = this.pendingDb;
    this.pendingDb = null;

    // Chain saves to avoid concurrent IndexedDB transaction conflicts
    this.savePromiseChain = this.savePromiseChain
      .catch(() => true)
      .then(() => this.executeSave(dbToSave));

    return this.savePromiseChain;
  }

  /**
   * Synchronous emergency flush used on pagehide / beforeunload
   */
  public flushSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingDb) {
      try {
        saveDatabaseToLocalStorage(this.pendingDb);
      } catch (err) {
        console.error('Emergency sync save failed:', err);
      }
    }
  }

  /**
   * Manual retry on save error
   */
  public retryNow(currentDb?: AppDatabaseSchema): Promise<boolean> {
    if (currentDb) {
      this.pendingDb = currentDb;
    }
    this.retryAttempts = 0;
    return this.flush();
  }

  /**
   * Core execute logic: Synchronous mirror to localStorage + Transactional commit to IndexedDB
   */
  private async executeSave(dbData: AppDatabaseSchema): Promise<boolean> {
    this.currentStatus = 'saving';
    this.lastError = null;
    this.notify();

    const cleanDb: AppDatabaseSchema = {
      ...dbData,
      exportedAt: new Date().toISOString(),
      baseSchedule: deduplicateRecords(dbData.baseSchedule || []),
      supportSchedule: deduplicateRecords(dbData.supportSchedule || []),
      dailyRecords: deduplicateRecords(dbData.dailyRecords || []),
      weeks: deduplicateRecords(dbData.weeks || []),
      liquidations: deduplicateRecords(dbData.liquidations || []),
      auditLogs: deduplicateRecords(dbData.auditLogs || []),
      trainingsAssignments: deduplicateRecords(dbData.trainingsAssignments || []),
    };

    try {
      // 1. Immediate mirror to localStorage
      saveDatabaseToLocalStorage(cleanDb);

      // 2. Transactional commit to IndexedDB
      if (isIndexedDBAvailable()) {
        const idbSaved = await saveToIndexedDB(cleanDb);
        if (!idbSaved) {
          throw new Error('فشلت معاملة الحفظ في قاعدة بيانات IndexedDB');
        }
      }

      // If another save was queued during execution, flush it
      if (this.pendingDb) {
        return this.flush();
      }

      this.retryAttempts = 0;
      this.currentStatus = 'saved';
      this.lastSavedTime = new Date().toLocaleTimeString('ar-DZ');
      this.lastError = null;
      this.notify();
      return true;
    } catch (err: any) {
      console.error('AutoSave failed:', err);
      // Retain pending data in memory
      this.pendingDb = cleanDb;
      this.currentStatus = 'error';
      this.lastError = err?.message || 'تعذر إتمام عملية الحفظ في قاعدة البيانات المحلية';
      this.notify();

      // Automatic retry with exponential backoff
      if (this.retryAttempts < this.MAX_RETRIES) {
        this.retryAttempts++;
        const delay = 500 * Math.pow(2, this.retryAttempts);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.flush();
        }, delay);
      }

      return false;
    }
  }

  /**
   * Setup browser lifecycle listeners
   */
  private setupLifecycleHooks(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeunload', () => {
      this.flushSync();
    });

    window.addEventListener('pagehide', () => {
      this.flushSync();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    }
  }
}

export const autoSaveEngine = new AutoSaveEngine();
