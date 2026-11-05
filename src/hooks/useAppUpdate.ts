/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { APP_VERSION, APP_BUILD_DATE } from '../utils/version.ts';
import { saveSnapshotToIndexedDB } from '../utils/indexedDb.ts';
import { loadDatabaseFromLocalStorage } from '../utils/storage.ts';

export interface AppUpdateState {
  hasUpdate: boolean;
  isChecking: boolean;
  isOfflineReady: boolean;
  lastCheckedAt: string | null;
  version: string;
  buildDate: string;
  applyUpdate: (force?: boolean) => Promise<boolean>;
  checkForUpdates: () => Promise<boolean>;
  dismissUpdatePrompt: () => void;
  isUpdateDismissed: boolean;
}

export function useAppUpdate(hasUnsavedChanges = false): AppUpdateState {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isOfflineReady, setIsOfflineReady] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState<boolean>(false);

  const updateSWFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  // Initialize service worker registration
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('[PWA Update] New application version detected and cached in background.');
          setHasUpdate(true);
          setIsUpdateDismissed(false);
        },
        onOfflineReady() {
          console.log('[PWA Update] Application is precached and ready for 100% offline usage.');
          setIsOfflineReady(true);
        },
        onRegisteredSW(swScriptUrl, registration) {
          console.log('[PWA Update] Service worker registered:', swScriptUrl);
          if (registration) {
            // Periodically check for update every 15 minutes when online
            const interval = setInterval(() => {
              if (navigator.onLine) {
                registration.update().catch((e) => console.debug('Periodic SW update check notice:', e));
              }
            }, 15 * 60 * 1000);

            return () => clearInterval(interval);
          }
        },
        onRegisterError(error) {
          console.warn('[PWA Update] Service worker registration error:', error);
        },
      });

      updateSWFnRef.current = updateSW;
    } catch (err) {
      console.warn('[PWA Update] registerSW failed:', err);
    }
  }, []);

  // Manual or programmatic update check
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }
    setIsChecking(true);
    setLastCheckedAt(new Date().toLocaleTimeString('ar-DZ'));

    try {
      if (!navigator.onLine) {
        setIsChecking(false);
        return false;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        // Check if a waiting worker appeared
        if (registration.waiting) {
          setHasUpdate(true);
          setIsUpdateDismissed(false);
          setIsChecking(false);
          return true;
        }
      }
    } catch (err) {
      console.warn('[PWA Update] Update check notice:', err);
    } finally {
      setIsChecking(false);
    }
    return false;
  }, []);

  // Listen to window focus & online events to trigger background checks
  useEffect(() => {
    const handleOnlineOrFocus = () => {
      if (navigator.onLine) {
        checkForUpdates().catch(() => {});
      }
    };

    window.addEventListener('online', handleOnlineOrFocus);
    window.addEventListener('focus', handleOnlineOrFocus);

    return () => {
      window.removeEventListener('online', handleOnlineOrFocus);
      window.removeEventListener('focus', handleOnlineOrFocus);
    };
  }, [checkForUpdates]);

  // Apply the update safely with automatic DB snapshot backup
  const applyUpdate = useCallback(async (force = false): Promise<boolean> => {
    if (hasUnsavedChanges && !force) {
      console.warn('[PWA Update] Postponing update: unsaved changes present.');
      return false;
    }

    try {
      // 1. Create a safety restore point in IndexedDB before updating
      const currentDb = loadDatabaseFromLocalStorage();
      await saveSnapshotToIndexedDB(currentDb, `نسخة أمان قبل التحديث إلى ${APP_VERSION}`);

      // 2. Activate waiting service worker and reload
      if (updateSWFnRef.current) {
        await updateSWFnRef.current(true);
      } else {
        window.location.reload();
      }
      return true;
    } catch (err) {
      console.error('[PWA Update] Failed to apply update safely:', err);
      // Fallback reload
      window.location.reload();
      return false;
    }
  }, [hasUnsavedChanges]);

  const dismissUpdatePrompt = useCallback(() => {
    setIsUpdateDismissed(true);
  }, []);

  return {
    hasUpdate,
    isChecking,
    isOfflineReady,
    lastCheckedAt,
    version: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    applyUpdate,
    checkForUpdates,
    dismissUpdatePrompt,
    isUpdateDismissed,
  };
}
