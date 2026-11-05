/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { AppSettings, LiquidationMethod, SchoolCancellationPolicy } from '../types/index.ts';
import { DEFAULT_SETTINGS } from '../utils/storage.ts';
import {
  Settings,
  Save,
  CheckCircle2,
  Clock,
  Calendar,
  Receipt,
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert,
  Sliders,
  Check,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  HardDrive,
  Database,
} from 'lucide-react';
import { APP_VERSION, APP_BUILD_DATE, APP_RELEASE_NAME, APP_CHANGELOG } from '../utils/version.ts';
import { useAppUpdate } from '../hooks/useAppUpdate.ts';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator.tsx';

export const SettingsView: React.FC = () => {
  const { db, updateSettings, showToast, hasUnsavedChanges, flushSave } = useApp();
  const {
    hasUpdate,
    isChecking,
    lastCheckedAt,
    applyUpdate,
    checkForUpdates,
  } = useAppUpdate(hasUnsavedChanges);

  const [settingsState, setSettingsState] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...db.settings,
    referenceWeeklySessions: db.settings.referenceWeeklySessions ?? db.settings.referenceWeeklyHours ?? 16,
    targetBaseWeeklySessions: db.settings.targetBaseWeeklySessions ?? db.settings.targetBaseWeeklyHours ?? 14,
    referenceSessionDurationMinutes: db.settings.referenceSessionDurationMinutes ?? 55,
    surplusSessionDurationMinutes: db.settings.surplusSessionDurationMinutes ?? 60,
    academicYear: db.settings.academicYear || '2026-2027',
    trainingTargetHours: db.settings.trainingTargetHours || 16,
    backupReminderEnabled: db.settings.backupReminderEnabled ?? true,
    backupReminderIntervalDays: db.settings.backupReminderIntervalDays ?? 7,
    autoSaveDebounceMs: db.settings.autoSaveDebounceMs ?? 400,
  }));

  // Debounced auto-save for settings inputs (300 to 500 ms)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (
        settingsState.referenceWeeklySessions > 0 &&
        settingsState.targetBaseWeeklySessions > 0 &&
        settingsState.academicYear?.trim()
      ) {
        updateSettings({
          ...settingsState,
          academicYear: settingsState.academicYear.trim(),
          referenceWeeklyHours: settingsState.referenceWeeklySessions,
          targetBaseWeeklyHours: settingsState.targetBaseWeeklySessions,
        });
      }
    }, settingsState.autoSaveDebounceMs || 400);

    return () => clearTimeout(timer);
  }, [settingsState, updateSettings]);

  // Flush on unmount to guarantee all changes persist immediately when navigating to other tabs
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  // Real-time calculation previews
  const refSessions = settingsState.referenceWeeklySessions || 16;
  const baseSessions = settingsState.targetBaseWeeklySessions || 14;
  const baseDuration = settingsState.referenceSessionDurationMinutes || 55;
  const surplusDuration = settingsState.surplusSessionDurationMinutes || 60;

  const totalRequiredRefMinutes = refSessions * baseDuration;
  const totalPlannedBaseMinutes = baseSessions * baseDuration;
  const calculatedBaseDeficitMinutes = totalRequiredRefMinutes - totalPlannedBaseMinutes;
  const calculatedBaseDeficitSessions = refSessions - baseSessions;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (settingsState.referenceWeeklySessions <= 0) {
      showToast('error', 'الحجم المرجعي المطلوب للحصص يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (settingsState.targetBaseWeeklySessions <= 0) {
      showToast('error', 'الحجم الصباحي الأساسي للحصص يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (settingsState.referenceSessionDurationMinutes <= 0) {
      showToast('error', 'مدة الحصة الأساسية المرجعية يجب أن تكون موجبة.');
      return;
    }
    if (settingsState.surplusSessionDurationMinutes <= 0) {
      showToast('error', 'مدة حصة تقييم الفائض المكافئة يجب أن تكون موجبة.');
      return;
    }
    if (!settingsState.academicYear || settingsState.academicYear.trim() === '') {
      showToast('error', 'يرجى تحديد الموسم الدراسي.');
      return;
    }
    if (settingsState.trainingTargetHours <= 0) {
      showToast('error', 'الحجم المطلوب للتكوينات والتكليفات يجب أن يكون أكبر من الصفر.');
      return;
    }

    const payload: AppSettings = {
      ...settingsState,
      academicYear: settingsState.academicYear.trim(),
      referenceWeeklyHours: settingsState.referenceWeeklySessions,
      targetBaseWeeklyHours: settingsState.targetBaseWeeklySessions,
    };

    updateSettings(payload);
  };

  const handleResetDefaults = () => {
    setSettingsState({
      ...DEFAULT_SETTINGS,
    });
    showToast('info', 'تمت استعادة الإعدادات المعتمدة الافتراضية.');
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
            ضبط الأنصبة المرجعية للحصص، مدد الحصص الأساسية والفائضة، وقواعد التصفية المالية
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>استعادة الافتراضيات المعتمدة</span>
          </button>

          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Session Volumes & Duration Parameters */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                الحجم الأسبوعي للحصص والمدد المرجعية
              </h2>
            </div>
            <span className="text-2xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              الوحدة: حصص ودقائق
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Reference Weekly Sessions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الحجم المرجعي المطلوب (حصص أسبوعيًا) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settingsState.referenceWeeklySessions}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    referenceWeeklySessions: Number(e.target.value),
                    referenceWeeklyHours: Number(e.target.value),
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                الحجم المطلوب أسبوعيًا (الافتراضي: 16 حصة = {settingsState.referenceWeeklySessions * settingsState.referenceSessionDurationMinutes} دقيقة)
              </span>
            </div>

            {/* Target Base Weekly Sessions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الحجم الصباحي الأساسي (حصص أسبوعيًا) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settingsState.targetBaseWeeklySessions}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    targetBaseWeeklySessions: Number(e.target.value),
                    targetBaseWeeklyHours: Number(e.target.value),
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                الحجم المبرمج في الجدول الأساسي (الافتراضي: 14 حصة = {settingsState.targetBaseWeeklySessions * settingsState.referenceSessionDurationMinutes} دقيقة)
              </span>
            </div>

            {/* Reference Session Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مدة الحصة الأساسية المرجعية (دقائق) <span className="text-rose-500">*</span>
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
                مدة الحصة الأساسية وعجز الغياب (الافتراضي: 55 دقيقة)
              </span>
            </div>

            {/* Surplus Evaluation Session Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مدة حصة تقييم الفائض المكافئة (دقائق) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="15"
                max="120"
                value={settingsState.surplusSessionDurationMinutes}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    surplusSessionDurationMinutes: Number(e.target.value),
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                وحدة تقييم الفائض إلى حصص مكافئة (الافتراضي: 60 دقيقة)
              </span>
            </div>
          </div>

          {/* Live Mathematical Preview Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>المعادلة المعتمدة للعجز الأسبوعي الأساسي:</span>
              </div>
              <div className="text-slate-600">
                (الحجم المرجعي {refSessions} حصة - الحجم الصباحي الأساسي {baseSessions} حصة) × {baseDuration} دقيقة ={' '}
                <span className="font-black text-rose-700 font-mono text-sm">
                  {calculatedBaseDeficitSessions} {calculatedBaseDeficitSessions === 1 ? 'حصة' : calculatedBaseDeficitSessions === 2 ? 'حصتان' : 'حصص'} = {calculatedBaseDeficitMinutes} دقيقة عجز أسبوعي أساسي
                </span>
              </div>
              <div className="text-slate-500 text-2xs">
                الحجم المطلوب: {totalRequiredRefMinutes} دقيقة | الحجم الأساسي: {totalPlannedBaseMinutes} دقيقة | وحدة تقييم الفائض: كل {surplusDuration} دقيقة = حصة فائضة واحدة مع الاحتفاظ بباقي الدقائق.
              </div>
            </div>

            <div className="shrink-0 bg-white px-3.5 py-2 rounded-lg border border-indigo-200/80 shadow-2xs text-center">
              <span className="text-2xs font-bold text-slate-500 block">العجز الأسبوعي الأساسي</span>
              <span className="font-mono font-black text-rose-600 text-base">{calculatedBaseDeficitMinutes} دقيقة</span>
            </div>
          </div>
        </div>

        {/* Section: Academic Season & Trainings Quota */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                إعدادات الموسم الدراسي والتكوينات والتكليفات
              </h2>
            </div>
            <span className="text-2xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full font-bold">
              متابعة موسمية مستقلة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Academic Year */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الموسم الدراسي الافتراضي <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={settingsState.academicYear}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    academicYear: e.target.value,
                  }))
                }
                placeholder="2026-2027"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                تحديد الموسم الدراسي النشط؛ كل موسم يُحفظ بسجلاته وإحصائياته المستقلة.
              </span>
            </div>

            {/* Training Target Hours */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الحجم الساعي المطلوب للتكوينات والتكليفات (ساعات) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settingsState.trainingTargetHours}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    trainingTargetHours: Number(e.target.value) || 16,
                  }))
                }
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                الحجم السنوي المستهدف: 16 ساعة تعادل {settingsState.trainingTargetHours * 60} دقيقة نظامية.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>تنبيه هام حول الاستقلالية:</strong> ساعات التكوينات والتكليفات هي متابعة سنوية مستقلة، ولا تُدمج بأي شكل في رصيد الحصص التدريسية الأسبوعية أو عجز الغيابات أو التصفية المالية.
            </div>
          </div>
        </div>

        {/* Section 2: Financial & Liquidation Rules */}
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
                <option value="per_session">بسعر الحصة المكافئة (كل {settingsState.surplusSessionDurationMinutes || 60} دقيقة = حصة)</option>
                <option value="per_hour">بسعر الساعة (كل 60 دقيقة = ساعة)</option>
              </select>
            </div>

            {/* Price per session */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سعر الحصة الفائضة الافتراضي ({settingsState.surplusSessionDurationMinutes || 60} دقيقة)
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

        {/* Section 3: Week Calendar Rules */}
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

        {/* Section: Auto-Save, IndexedDB & Periodic Backup Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                الحفظ التلقائي الفوري والتخزين المحلي (IndexedDB)
              </h2>
            </div>
            <SaveStatusIndicator variant="full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* AutoSave Status */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">حالة الحفظ التلقائي:</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                  <Check className="w-3.5 h-3.5" />
                  <span>مفعل دائمًا (تلقائي 100%)</span>
                </span>
              </div>
              <p className="text-2xs text-slate-500 mt-2">
                يُحفظ كل تعديل في الحصص أو الغيابات أو الإعدادات فور إجرائه داخل قاعدة بيانات المتصفح دون الحاجة للضغط على أي زر.
              </p>
            </div>

            {/* Debounce Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مهلة حفظ حقول الإدخال بعد التوقف عن الكتابة (مللي ثانية)
              </label>
              <input
                type="number"
                min="300"
                max="1000"
                step="50"
                value={settingsState.autoSaveDebounceMs || 400}
                onChange={(e) =>
                  setSettingsState((prev) => ({
                    ...prev,
                    autoSaveDebounceMs: Number(e.target.value) || 400,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-500 mt-1 block">
                القيمة الموصى بها: بين 300 و 500 مللي ثانية (الافتراضي: 400 مللي ثانية).
              </span>
            </div>

            {/* Backup Reminder Settings */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تذكير دوري بالنسخ الاحتياطي (أيام)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  disabled={!settingsState.backupReminderEnabled}
                  value={settingsState.backupReminderIntervalDays || 7}
                  onChange={(e) =>
                    setSettingsState((prev) => ({
                      ...prev,
                      backupReminderIntervalDays: Number(e.target.value) || 7,
                    }))
                  }
                  className="w-24 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:opacity-50"
                />
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={settingsState.backupReminderEnabled !== false}
                    onChange={(e) =>
                      setSettingsState((prev) => ({
                        ...prev,
                        backupReminderEnabled: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>تفعيل التذكير الدوري</span>
                </label>
              </div>
              <span className="text-2xs text-slate-500 mt-1 block">
                تذكير لطيف لتنزيل نسخة JSON احتياطية دورياً لضمان سلامة الملفات خارج الجهاز.
              </span>
            </div>
          </div>

          {/* Offline Persistence Guarantee Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/70 to-slate-50 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
            <Database className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-slate-900 block font-bold">
                محرك التخزين المحلي IndexedDB:
              </strong>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                يعتمد التطبيق على IndexedDB كقاعدة بيانات محلية رئيسية لإتمام المعاملات الكتابية، مع تزامن فوري في localStorage. يعمل النظام بالكامل دون اتصال بالإنترنت، وتبقى بياناتك محفوظة ومحمية بعد إغلاق المتصفح أو إعادة تشغيل الجهاز أو تثبيت التحديثات الجديدة.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Rules Reference Card (القواعد المحاسبية المعتمدة 1-10) */}
        <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                دليل القواعد المحاسبية المعتمدة في محرك الحسابات
              </h2>
            </div>
            <span className="text-2xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
              معتمد في جميع الصفحات
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">1</span>
              <div>
                <span className="font-bold text-white">الحجم الصباحي الأساسي:</span> 14 حصة أسبوعيًا (وليس 14 ساعة).
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">2</span>
              <div>
                <span className="font-bold text-white">الحجم المرجعي المطلوب:</span> 16 حصة أسبوعيًا (وليس 16 ساعة).
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">3</span>
              <div>
                <span className="font-bold text-white">مدة الحصة الأساسية المرجعية:</span> 55 دقيقة، والعجز الأساسي الأسبوعي = حصتان = 110 دقائق.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">4</span>
              <div>
                <span className="font-bold text-white">أثر الغياب والتأخر:</span> كل غياب عن حصة أساسية يضيف 55 دقيقة إلى العجز، وكل تأخر يضيف دقائق التأخر الفعلية.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">5</span>
              <div>
                <span className="font-bold text-white">منع التكرار المزدوج:</span> لا يُحتسب الغياب أو التأخر مرتين؛ احتساب نقص الإنجاز يضبط العجز تلقائيًا دون ازدواج.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">6</span>
              <div>
                <span className="font-bold text-white">تسديد العجز بالحصص الإضافية:</span> تُخصم مدة الحصص الإضافية المنجزة مباشرة من العجز المتراكم.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">7</span>
              <div>
                <span className="font-bold text-white">عرض العجز:</span> إذا بقي عجز بعد الحساب، يُعرض صراحة بالدقائق (مثلاً: عجز 175 دقيقة).
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">8</span>
              <div>
                <span className="font-bold text-white">تقييم الفائض:</span> عند تحقق فائض بعد سداد العجز، يُحوّل إلى حصص مكافئة على أساس 60 دقيقة للحصة مع الاحتفاظ بباقي الدقائق.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">9</span>
              <div>
                <span className="font-bold text-white">فصل الوحدات:</span> الحصة الأساسية (55 د) vs وحدة تقييم الفائض (60 د)، وجميع الحسابات الداخلية بالدقائق الصحيحة.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">10</span>
              <div>
                <span className="font-bold text-white">شرط الاعتماد:</span> الأسابيع غير المُقيّمة لا تدخل نهائيًا في الرصيد الصافي المعتمد، وتظهر في المعاينة فقط.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5 md:col-span-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center shrink-0 text-2xs">11</span>
              <div>
                <span className="font-bold text-white">استقلالية التكوينات والتكليفات:</span> تخضع لهدف موسمي مستقل قدره 16 ساعة (960 دقيقة)، تُقاس مددها المنجزة بدقة بالدقائق، وتبقى معزولة تمامًا عن رصيد حصص التدريس وعجز الغيابات والتصفية المالية.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5 md:col-span-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-2xs">12</span>
              <div>
                <span className="font-bold text-white">الرزنامة الذكية وكشف الحصص المنسية:</span> تُستخرج الحصص أسبوعياً تلقائياً من الجدول الثابت؛ تظهر الحصة المنتهية غير المسجلة باللون الأحمر «لم يتم التسجيل» للتنبيه، دون تصنيفها غياباً آلياً أو التأثير في الرصيد المعتمد قبل مراجعة الأستاذ وتحديد حالتها.
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: App Version & Auto-Update System */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                إصدار التطبيق ونظام التحديث التلقائي (PWA)
              </h2>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-black">
              الإصدار الحالي: {APP_VERSION}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-500 block mb-1">رقم الإصدار المثبت:</span>
              <span className="text-lg font-black text-slate-900 font-mono">v{APP_VERSION}</span>
              <span className="text-2xs text-slate-500 block mt-1">تاريخ البناء: {APP_BUILD_DATE}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-500 block mb-1">جاهزية العمل دون إنترنت:</span>
              <div className="flex items-center gap-1.5 text-emerald-700 font-black text-sm mt-1">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>مفعلة 100% (Offline Ready)</span>
              </div>
              <span className="text-2xs text-slate-500 block mt-1">Service Worker + IndexedDB نشط</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-500 block mb-1">فحص التحديثات:</span>
                <span className="text-xs text-slate-700 font-medium block">
                  {lastCheckedAt ? `آخر فحص: ${lastCheckedAt}` : 'يتم الفحص تلقائياً عند الاتصال'}
                </span>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  disabled={isChecking}
                  onClick={async () => {
                    const found = await checkForUpdates();
                    if (found) {
                      showToast('info', 'تم اكتشاف إصدار جديد وتنزيله في الخلفية وهو جاهز للتطبيق.');
                    } else {
                      showToast('success', `تطبيقك يعمل على أحدث إصدار متاح (v${APP_VERSION}).`);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'جارٍ الفحص...' : 'التحقق من وجود تحديثات الآن'}</span>
                </button>
              </div>
            </div>
          </div>

          {hasUpdate && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in text-xs">
              <div>
                <div className="font-extrabold text-slate-900 text-sm">
                  يتوفر تحديث جديد تم تنزيله في الخلفية وجاهز للتطبيق!
                </div>
                <div className="text-slate-600 text-2xs mt-0.5">
                  سيتم إنشاء نقطة استعادة فورية لبياناتك وتحديث ملفات البرنامج دون مسح أي سجل.
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyUpdate(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                تطبيق التحديث الآن
              </button>
            </div>
          )}

          {/* Absolute Data Protection Guarantee */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
            <div className="font-extrabold flex items-center gap-2 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ضمان الحماية المطلقة لبياناتك المهنية أثناء التحديثات</span>
            </div>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              يفصل النظام فصلاً تاماً بين ملفات البرمجية التي يجري تحديثها وقواعد بياناتك المخزنة محلياً (الحصص الأساسية، حصص الدعم، الحضور والغيابات، التكوينات، والتصفيات المالية). التحديث لا يمسح الذاكرة المحلية ولا يتطلب إعادة التثبيت، كما ينشئ نقطة استعادة تلقائية قبل كل ترقية.
            </p>
          </div>

          {/* Release Notes */}
          <div className="text-xs space-y-2">
            <div className="font-bold text-slate-700">أبرز مزايا الإصدار v{APP_VERSION} ({APP_RELEASE_NAME}):</div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] pr-2">
              {APP_CHANGELOG.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-xs transition-all cursor-pointer"
          >
            استعادة الافتراضيات
          </button>
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
