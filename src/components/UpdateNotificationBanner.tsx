/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useAppUpdate } from '../hooks/useAppUpdate.ts';
import { Sparkles, RefreshCw, X, ShieldCheck, AlertCircle } from 'lucide-react';

export const UpdateNotificationBanner: React.FC = () => {
  const { hasUnsavedChanges, saveAll, showToast } = useApp();
  const { hasUpdate, isUpdateDismissed, applyUpdate, dismissUpdatePrompt, version } = useAppUpdate(hasUnsavedChanges);
  const [isApplying, setIsApplying] = useState(false);

  if (!hasUpdate || isUpdateDismissed) {
    return null;
  }

  const handleApply = async () => {
    setIsApplying(true);
    if (hasUnsavedChanges) {
      const saved = saveAll(false);
      if (!saved) {
        showToast('error', 'يرجى حفظ التغييرات الحالية أولاً قبل تطبيق التحديث.');
        setIsApplying(false);
        return;
      }
    }
    showToast('info', 'جارٍ تطبيق التحديث وتحديث ملفات التطبيق بأمان...');
    await applyUpdate(true);
  };

  return (
    <aside
      aria-label="إشعار التحديث"
      className="no-print bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white px-4 py-3 shadow-lg border-b border-indigo-500/40 sticky top-0 z-50 animate-fade-in"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-right">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
          </div>
          <div>
            <div className="font-black text-sm flex items-center gap-2">
              <span>تحديث جديد جاهز للتطبيق (الإصدار {version})</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold">
                تنزيل في الخلفية
              </span>
            </div>
            <p className="text-indigo-100 text-[11px] mt-0.5">
              تم تنزيل ملفات التحديث بنجاح. بياناتك المحلية وسجلات الحصص محمية بالكامل ولن تتأثر إطلاقاً.
              {hasUnsavedChanges && (
                <span className="text-amber-300 font-bold mr-1 block sm:inline">
                  (سيتم حفظ تعديلاتك الحالية تلقائياً قبل إعادة التشغيل)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={dismissUpdatePrompt}
            className="px-3 py-1.5 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer font-bold"
          >
            تذكيري لاحقاً
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-indigo-900 font-black shadow-md hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
            <span>{isApplying ? 'جارٍ التحديث...' : 'تطبيق التحديث الآن'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
