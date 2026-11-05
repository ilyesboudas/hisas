/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ShieldCheck, Download, Clock, X, Check } from 'lucide-react';

export const BackupReminderBanner: React.FC = () => {
  const { db, exportJsonBackup, updateSettings } = useApp();
  const [isDismissedTemporarily, setIsDismissedTemporarily] = useState(false);

  const shouldShow = useMemo(() => {
    if (isDismissedTemporarily) return false;
    if (db.settings.backupReminderEnabled === false) return false;

    // Only remind if user has actual activity (at least 3 daily records or base schedule items)
    const totalActivity = (db.dailyRecords || []).length + (db.baseSchedule || []).length;
    if (totalActivity < 3) return false;

    const intervalDays = db.settings.backupReminderIntervalDays || 7;
    const lastBackup = db.settings.lastBackupDate;

    if (!lastBackup) {
      // Never backed up yet
      return true;
    }

    const lastTime = new Date(lastBackup).getTime();
    const now = Date.now();
    const diffDays = (now - lastTime) / (1000 * 60 * 60 * 24);

    return diffDays >= intervalDays;
  }, [db.settings, db.dailyRecords, db.baseSchedule, isDismissedTemporarily]);

  if (!shouldShow) return null;

  const handleExportNow = () => {
    exportJsonBackup();
    setIsDismissedTemporarily(true);
  };

  const handleRemindLater = () => {
    setIsDismissedTemporarily(true);
  };

  const handleDisableReminder = () => {
    updateSettings({
      ...db.settings,
      backupReminderEnabled: false,
    });
    setIsDismissedTemporarily(true);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/90 px-4 py-2.5 text-xs text-amber-900 animate-fade-in shadow-2xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-amber-950 block sm:inline">
              تذكير دوري بالأمان:
            </span>{' '}
            <span className="text-amber-900">
              بياناتك محفوظة تلقائياً في قاعدة البيانات المحلية. يُنصح أيضاً بتنزيل نسخة احتياطية خارجية (JSON) بصفة دورية لضمان أمان تام.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleExportNow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير الآن (JSON)</span>
          </button>

          <button
            onClick={handleRemindLater}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100/70 text-amber-800 font-medium text-2xs transition-colors cursor-pointer"
            title="تذكيري لاحقاً بعد إعادة فتح التطبيق"
          >
            <Clock className="w-3 h-3 text-amber-700" />
            <span>لاحقاً</span>
          </button>

          <button
            onClick={handleDisableReminder}
            className="p-1.5 rounded-lg hover:bg-amber-200/60 text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
            title="إلغاء التذكير الدوري"
            aria-label="إغلاق التذكير"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
