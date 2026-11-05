/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'prominent' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'navbar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed and running standalone, show a subtle check badge or return null in navbar
  if (isInstalled) {
    if (variant === 'prominent') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>التطبيق مُثبت ويعمل كبرنامج مستقل (Offline Ready)</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      await install();
      setIsInstalling(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // In Chromium / desktop when beforeinstallprompt has not fired or already handled
      alert('لتثبيت التطبيق، انقر على أيقونة التثبيت ⊕ في شريط العنوان أعلى المتصفح، أو اختر "تثبيت التطبيق" من قائمة خيارات المتصفح.');
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        title="تثبيت التطبيق كبرنامج مستقل يعمل دون إنترنت"
        className={`flex items-center gap-2 font-medium transition-all duration-200 shadow-sm active:scale-95 ${
          variant === 'navbar'
            ? 'px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 border border-blue-500/30 ring-2 ring-blue-500/20'
            : variant === 'prominent'
            ? 'px-4 py-2.5 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md font-semibold'
            : 'px-2.5 py-1 text-xs rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200'
        } ${className}`}
      >
        <Download className="w-4 h-4 animate-bounce" />
        <span>تثبيت التطبيق (Offline)</span>
      </button>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  تثبيت التطبيق على آيفون / آيباد
                </h3>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Smartphone className="w-4 h-4" />
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              يدعم متصفح Safari في نظام iOS التثبيت السهل ليصبح التطبيق متاحاً على شاشتك الرئيسية ويعمل دون اتصال بالإنترنت:
            </p>

            <div className="mt-4 space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <div className="flex-1">
                  اضغط على زر <strong className="text-slate-900 font-bold">المشاركة</strong>{' '}
                  <Share className="inline w-3.5 h-3.5 mx-1 text-blue-600" /> في شريط متصفح Safari (أسفل أو أعلى الشاشة).
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <div className="flex-1">
                  مرّر للأسفل في قائمة الخيارات وانقر على{' '}
                  <strong className="text-slate-900 font-bold">«إضافة إلى الشاشة الرئيسية»</strong>{' '}
                  <PlusSquare className="inline w-3.5 h-3.5 mx-1 text-emerald-600" />.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <div className="flex-1">
                  اضغط <strong className="text-slate-900 font-bold">«إضافة» (Add)</strong> في الزاوية العلوية ليتم حفظ التطبيق وتثبيته فوراً.
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                فهمت ذلك، شكراً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
