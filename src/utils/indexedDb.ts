/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppDatabaseSchema } from '../types/index.ts';
import { normalizeDatabase } from './storage.ts';

const DB_NAME = 'TadweenTeachingSessionsDB';
const DB_VERSION = 2; // Bump version to 2 to guarantee onupgradeneeded runs for all clients
const STORE_STATE = 'app_state';
const STORE_SNAPSHOTS = 'snapshots';

/**
 * Open or upgrade the IndexedDB instance safely with timeout and block handling
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    let isSettled = false;
    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error('IndexedDB open timeout (fell back to local storage)'));
      }
    }, 3000);

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE);
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked by another tab or connection.');
      };

      request.onsuccess = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutTimer);
          resolve(request.result);
        }
      };

      request.onerror = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutTimer);
          reject(request.error || new Error('IndexedDB open failed'));
        }
      };
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutTimer);
        reject(err);
      }
    }
  });
}

/**
 * Check if IndexedDB is supported in the current environment
 */
export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

/**
 * Save current database schema to IndexedDB with strict transaction completion.
 * Never throws uncaught errors; returns false on failure.
 */
export async function saveToIndexedDB(dbData: AppDatabaseSchema): Promise<boolean> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_STATE)) {
      console.warn('IndexedDB STORE_STATE not found, falling back to localStorage');
      return false;
    }

    return await new Promise<boolean>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_STATE, 'readwrite');
        const store = tx.objectStore(STORE_STATE);

        const cleanDb = normalizeDatabase(dbData);
        const meta = {
          savedAt: new Date().toISOString(),
          version: cleanDb.version,
          recordsCount: (cleanDb.dailyRecords || []).length,
          weeksCount: (cleanDb.weeks || []).length,
          academicYear: cleanDb.settings?.academicYear || '',
        };

        store.put(cleanDb, 'current_db');
        store.put(meta, 'db_meta');

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      } catch (txErr) {
        reject(txErr);
      }
    });
  } catch (err) {
    console.warn('saveToIndexedDB caught error, localStorage mirror remains active:', err);
    return false;
  }
}

/**
 * Load current database schema from IndexedDB safely, guaranteed to return normalized schema or null
 */
export async function loadFromIndexedDB(): Promise<AppDatabaseSchema | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_STATE)) {
      return null;
    }

    return await new Promise<AppDatabaseSchema | null>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_STATE, 'readonly');
        const store = tx.objectStore(STORE_STATE);
        const req = store.get('current_db');

        req.onsuccess = () => {
          const result = req.result;
          if (!result) return resolve(null);
          // Return clean, fully-hydrated and normalized schema
          resolve(normalizeDatabase(result));
        };
        req.onerror = () => reject(req.error);
      } catch (txErr) {
        reject(txErr);
      }
    });
  } catch (err) {
    console.warn('loadFromIndexedDB safely handled notice:', err);
    return null;
  }
}

export interface LocalDBSnapshot {
  id: string;
  timestamp: string;
  note: string;
  recordCount: number;
  data: AppDatabaseSchema;
}

/**
 * Save a restore point snapshot in IndexedDB safely
 */
export async function saveSnapshotToIndexedDB(
  dbData: AppDatabaseSchema,
  note = 'نقطة استعادة تلقائية'
): Promise<string | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
      return null;
    }

    const id = `snapshot_${Date.now()}`;
    const cleanDb = normalizeDatabase(dbData);
    const snapshot: LocalDBSnapshot = {
      id,
      timestamp: new Date().toISOString(),
      note,
      recordCount: (cleanDb.dailyRecords || []).length,
      data: cleanDb,
    };

    return await new Promise<string | null>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.put(snapshot);

        req.onsuccess = () => resolve(id);
        req.onerror = () => reject(req.error);
      } catch (txErr) {
        reject(txErr);
      }
    });
  } catch (err) {
    console.warn('Failed to save snapshot to IndexedDB:', err);
    return null;
  }
}

/**
 * List all local snapshots stored in IndexedDB
 */
export async function listSnapshotsFromIndexedDB(): Promise<LocalDBSnapshot[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
      return [];
    }

    return await new Promise<LocalDBSnapshot[]>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.getAll();

        req.onsuccess = () => {
          const list = (req.result || []) as LocalDBSnapshot[];
          list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      } catch (txErr) {
        reject(txErr);
      }
    });
  } catch (err) {
    console.warn('Failed to list snapshots from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a local snapshot from IndexedDB
 */
export async function deleteSnapshotFromIndexedDB(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
      return false;
    }

    return await new Promise<boolean>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (txErr) {
        reject(txErr);
      }
    });
  } catch (err) {
    console.warn('Failed to delete snapshot from IndexedDB:', err);
    return false;
  }
}
