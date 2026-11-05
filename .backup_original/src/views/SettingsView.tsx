/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { AppSettings, LiquidationMethod, SchoolCancellationPolicy } from '../types/index.ts';
import {
  Settings,
  Save,
  CheckCircle2,
  Clock,
  Calendar,
  Receipt,
  Shield,
  Info,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { db, updateSettings, showToast } = useApp();

  const [settingsState, setSettingsState] = useState<AppSettings>({ ...db.settings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (settingsState.referenceWeeklyHours <= 0) {
      showToast('error', 'الحجم الساعي الأسبوعي المرجعي يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (settingsState.targetBaseWeeklyHours <= 0) {
      showToast('error', 'الحجم الأساسي الأسبوعي المستهدف يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (settingsState.referenceSessionDurationMinutes <= 0) {
      showToast('error', 'مدة الحصة المرجعية يجب أن تكون موجبة.');
      return;
    }

    updateSettings(settingsState);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            <span>إعدادات النظام وقواعد المحاسبة الزمنية</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ضبط الأنصبة الساعية المرجعية، مدة الحصة، قواعد الأسابيع والتصفية المالية
          </p>
        </div>

        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>حفظ الإعدادات</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Time Volumes & Sessions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              الأحجام الساعية والمدد المرجعية
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Reference Weekly Hours */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الحجم الساعي الأسبوعي المرجعي (ساعات) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settingsState.referenceWeeklyHours}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    referenceWeeklyHours: Number(e.target.value),
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                الحجم المطلوب تعاقديًا (الافتراضي: 16 ساعة أسبوعيًا = {settingsState.referenceWeeklyHours * 60} دقيقة)
              </span>
            </div>

            {/* Target Base Weekly Hours */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الحجم الأساسي الأسبوعي المبرمج (ساعات) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settingsState.targetBaseWeeklyHours}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    targetBaseWeeklyHours: Number(e.target.value),
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                الحجم الفعلي لجدول الحصص الأساسية (الافتراضي: 14 ساعة = {settingsState.targetBaseWeeklyHours * 60} دقيقة)
              </span>
            </div>

            {/* Reference Session Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مدة الحصة المرجعية (دقائق) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="15"
                max="120"
                value={settingsState.referenceSessionDurationMinutes}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    referenceSessionDurationMinutes: Number(e.target.value),
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                تُستخدم لتحويل الرصيد الزمني إلى مكافئ حصص (الافتراضي: 55 دقيقة)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            الفرق الأسبوعي الأساسي المبرمج بين المرجعي والأساسي:{' '}
            <span className="font-extrabold text-indigo-700 font-mono">
              {settingsState.referenceWeeklyHours - settingsState.targetBaseWeeklyHours} ساعات أسبوعيًا
            </span>{' '}
            ({(settingsState.referenceWeeklyHours - settingsState.targetBaseWeeklyHours) * 60} دقيقة).
            تُعوّض هذه الساعات بواسطة الحصص الإضافية وحصص الدعم.
          </div>
        </div>

        {/* Section 2: Week Calendar Rules */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              قواعد تقويم الأسابيع والعطل
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">بداية الأسبوع التعليمي:</span>
              <span className="text-sm font-black text-indigo-700">يوم السبت</span>
              <span className="text-2xs text-slate-500 block mt-1">يبدأ حساب الأسبوع السبت صباحًا</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">نهاية الأسبوع التعليمي:</span>
              <span className="text-sm font-black text-indigo-700">يوم الخميس</span>
              <span className="text-2xs text-slate-500 block mt-1">تنتهي مدة التدريس العادية الخميس مساءً</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">يوم العطلة الأسبوعية:</span>
              <span className="text-sm font-black text-amber-700">يوم الجمعة</span>
              <span className="text-2xs text-slate-500 block mt-1">مستبعد من الجدول الأساسي النظامي</span>
            </div>
          </div>
        </div>

        {/* Section 3: Financial & Liquidation Rules */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              إعدادات التصفية المالية والأسعار الافتراضية
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Liquidation Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                طريقة التصفية المالية الافتراضية
              </label>
              <select
                value={settingsState.liquidationMethod}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    liquidationMethod: e.target.value as LiquidationMethod,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="per_session">بسعر الحصة (كل 55 دقيقة = حصة)</option>
                <option value="per_hour">بسعر الساعة (كل 60 دقيقة = ساعة)</option>
              </select>
            </div>

            {/* Price per session */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سعر الحصة الافتراضي (55 دقيقة)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={settingsState.pricePerSession}
                  onChange={(e) =>
                    setSettingsState((prev) => ({
                      ...prev,
                      pricePerSession: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pl-10"
                />
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                  {settingsState.currency}
                </span>
              </div>
            </div>

            {/* Price per hour */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سعر الساعة الافتراضي (60 دقيقة)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={settingsState.pricePerHour}
                  onChange={(e) =>
                    setSettingsState((prev) => ({
                      ...prev,
                      pricePerHour: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pl-10"
                />
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                  {settingsState.currency}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
            {/* Currency Symbol */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رمز العملة
              </label>
              <input
                type="text"
                value={settingsState.currency}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    currency: e.target.value,
                  }))
                }
                placeholder="دج أو DZD"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                الدينار الجزائري (دج / DZD)
              </span>
            </div>

            {/* School Cancellation Policy */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سياسة الحصص الملغاة بقرار من المؤسسة
              </label>
              <select
                value={settingsState.schoolCancellationPolicy}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    schoolCancellationPolicy: e.target.value as SchoolCancellationPolicy,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="waived_as_completed">
                  تحسب كحصة معفاة منجزة (لا تلزم بتعويضها)
                </option>
                <option value="deduct_from_target">
                  تخفض من الحجم المطلوب للأسبوع
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ جميع الإعدادات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
