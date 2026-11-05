/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { CheckCircle2, Loader2, AlertCircle, RotateCw } from 'lucide-react';

interface SaveStatusIndicatorProps {
  className?: string;
  variant?: 'full' | 'compact';
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  className = '',
  variant = 'full',
}) => {
  const { saveStatus, lastSavedAt, saveError, retrySave } = useApp();

  if (saveStatus === 'saving') {
    return (
      <div
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 animate-pulse ${className}`}
        title="جارٍ حفظ التغييرات تلقائيًا في قاعدة البيانات المحلية (IndexedDB)"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
        <span className="font-bold">جارٍ الحفظ...</span>
      </div>
    );
  }

  if (saveStatus === 'error') {
    return (
      <div
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-rose-50 border border-rose-300 text-rose-800 shadow-2xs ${className}`}
        title={saveError || 'تعذر الحفظ في قاعدة البيانات المحلية'}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span className="font-black">تعذر الحفظ</span>
        <button
          onClick={() => retrySave()}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-2xs transition-colors cursor-pointer"
        >
          <RotateCw className="w-3 h-3" />
          <span>إعادة المحاولة</span>
        </button>
      </div>
    );
  }

  // Default: 'saved'
  return (
    <div
      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200 text-emerald-800 transition-colors ${className}`}
      title="جميع التغييرات محفوظة تلقائيًا في IndexedDB بدون إنترنت"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <div className="flex items-center gap-1 font-bold">
        <span>تم الحفظ تلقائيًا ✓</span>
        {variant === 'full' && lastSavedAt && (
          <span className="text-2xs font-mono font-medium text-emerald-700/80">
            ({lastSavedAt})
          </span>
        )}
      </div>
    </div>
  );
};
