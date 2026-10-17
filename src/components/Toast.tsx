/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useApp();

  if (!toast) return null;

  const bgMap = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-indigo-600 text-white',
  };

  const IconMap = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  };

  const Icon = IconMap[toast.type];

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl transition-all duration-300 max-w-md animate-fade-in text-sm font-medium">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg ${bgMap[toast.type]}`}>
        <Icon className="w-5 h-5 shrink-0" />
        <span className="leading-snug">{toast.message}</span>
        <button
          onClick={clearToast}
          aria-label="إغلاق التنبيه"
          className="mr-2 p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
