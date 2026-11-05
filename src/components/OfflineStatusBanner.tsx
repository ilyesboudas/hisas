/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { WifiOff, Wifi, CheckCircle2, ShieldCheck } from 'lucide-react';

export const OfflineStatusBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestoredNotice(false);
    } else if (wasOffline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white text-xs px-4 py-2 shadow-md flex items-center justify-between no-print transition-all">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <WifiOff className="w-4 h-4 text-amber-200 flex-shrink-0" />
            <span className="font-semibold">وضع عدم الاتصال (Offline Mode):</span>
            <span className="hidden sm:inline text-amber-100">
              التطبيق يعمل بكامل طاقته محلياً. جميع السجلات، الحسابات، الأرصدة، والتصفية المالية محفوظة بأمان على جهازك.
            </span>
            <span className="sm:hidden text-amber-100">
              التطبيق يعمل محلياً بكفاءة 100%.
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-700/80 px-2.5 py-1 rounded-md text-[11px] font-medium border border-amber-500/40">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
            <span>حفظ محلي آمن</span>
          </div>
        </div>
      </div>
    );
  }

  if (showRestoredNotice) {
    return (
      <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 shadow-md flex items-center justify-center gap-2 no-print transition-all">
        <Wifi className="w-4 h-4 text-emerald-200" />
        <span className="font-semibold">تم استعادة الاتصال بالإنترنت</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
      </div>
    );
  }

  return null;
};
