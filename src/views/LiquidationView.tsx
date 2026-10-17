/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LiquidationMethod, LiquidationRecord } from '../types/index.ts';
import { calculatePeriodSummary, createLiquidationSnapshot } from '../utils/calculationEngine.ts';
import { formatDateArabic, formatLocalDate, getSaturdayOfWeek, getThursdayOfWeek } from '../utils/dateUtils.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  Receipt,
  Printer,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
  DollarSign,
  Trash2,
  History,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';

export const LiquidationView: React.FC = () => {
  const { db, addLiquidation, deleteLiquidation } = useApp();

  // Period inputs
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>(formatLocalDate(new Date()));
  const [method, setMethod] = useState<LiquidationMethod>(db.settings.liquidationMethod || 'per_session');
  const [rate, setRate] = useState<number>(() => {
    return (db.settings.liquidationMethod || 'per_session') === 'per_session'
      ? db.settings.pricePerSession
      : db.settings.pricePerHour;
  });
  const [manualAdjustment, setManualAdjustment] = useState<number>(0);
  const [manualAdjustmentReason, setManualAdjustmentReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Active view: 'new_liquidation' | 'archive'
  const [activeTab, setActiveTab] = useState<'new_liquidation' | 'archive'>('new_liquidation');
  const [selectedArchived, setSelectedArchived] = useState<LiquidationRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync rate when method changes
  const handleMethodChange = (newMethod: LiquidationMethod) => {
    setMethod(newMethod);
    if (newMethod === 'per_session') {
      setRate(db.settings.pricePerSession);
    } else {
      setRate(db.settings.pricePerHour);
    }
  };

  // Live calculation of preview summary
  const summary = useMemo(() => {
    return calculatePeriodSummary(
      db.weeks,
      db.dailyRecords,
      db.baseSchedule,
      db.settings,
      {
        startDate,
        endDate,
        method,
        rate,
        manualAdjustment,
        manualAdjustmentReason,
      }
    );
  }, [db.weeks, db.dailyRecords, db.baseSchedule, db.settings, startDate, endDate, method, rate, manualAdjustment, manualAdjustmentReason]);

  // Handle approving liquidation
  const handleApproveLiquidation = () => {
    const snapshot = createLiquidationSnapshot(summary);
    addLiquidation({
      startDate,
      endDate,
      calculationMethod: method,
      rate,
      manualAdjustment,
      manualAdjustmentReason: manualAdjustment ? manualAdjustmentReason : undefined,
      notes,
      status: 'approved',
      snapshot,
    });
    setActiveTab('archive');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Header */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            <span>التصفية المالية النهائية</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            حساب الرصيد الصافي المعتمد، وتحديد المستحقات المالية بين الأستاذ والمدرسة مع أرشفة التقارير
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab('new_liquidation');
                setSelectedArchived(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'new_liquidation' && !selectedArchived
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              إنشاء تصفية جديدة
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'archive' || selectedArchived
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              أرشيف التصفيات المعتمدة ({db.liquidations.length})
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الكشف</span>
          </button>
        </div>
      </div>

      {activeTab === 'archive' && !selectedArchived ? (
        /* ARCHIVE TAB */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">سجل التصفيات المالية المعتمدة سابقًا</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              نسخ ثابتة ومؤرشفة من التصفيات المعتمدة مع تواريخ الاعتماد ومكونات الرصيد
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">تاريخ الاعتماد</th>
                  <th className="p-3.5">فترة التصفية</th>
                  <th className="p-3.5">الأسابيع المعتمدة</th>
                  <th className="p-3.5">الرصيد الزمني الصافي</th>
                  <th className="p-3.5">المبلغ المالي</th>
                  <th className="p-3.5">الاتجاه المستحق</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.liquidations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      لا توجد تصفيات مالية معتمدة في الأرشيف بعد. يمكنك إنشاء واعتماد تصفية من علامة التبويب «إنشاء تصفية جديدة».
                    </td>
                  </tr>
                ) : (
                  db.liquidations.map((liq) => (
                    <tr key={liq.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 whitespace-nowrap text-slate-700">
                        {liq.approvedAt ? new Date(liq.approvedAt).toLocaleDateString('ar-DZ') : '—'}
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold text-slate-900">
                        {formatDateArabic(liq.startDate, false)} — {formatDateArabic(liq.endDate, false)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-600">
                        {liq.snapshot.evaluatedWeeksCount} أسبوع معتمد
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold text-indigo-700">
                        <span className="font-mono">{liq.snapshot.hours}</span> س و <span className="font-mono">{liq.snapshot.minutes}</span> د (<span className="font-mono">{liq.snapshot.equivalentSessions}</span> حصة و <span className="font-mono">{liq.snapshot.remainderMinutes}</span> د)
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold text-slate-900">
                        <span className="font-mono">{liq.snapshot.financialAmount.toLocaleString('ar-DZ')}</span> {db.settings.currency}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-2xs font-extrabold ${
                            liq.snapshot.beneficiary === 'teacher'
                              ? 'bg-emerald-100 text-emerald-800'
                              : liq.snapshot.beneficiary === 'school'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {liq.snapshot.beneficiary === 'teacher'
                            ? 'لصالح الأستاذ'
                            : liq.snapshot.beneficiary === 'school'
                            ? 'لصالح المدرسة'
                            : 'متوازن'}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedArchived(liq)}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          >
                            عرض وطباعة
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(liq.id)}
                            aria-label="حذف التصفية من الأرشيف"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* NEW LIQUIDATION OR VIEWING ARCHIVED RECORD */
        <div className="space-y-6">
          {/* Inputs Section (Hidden in print and when viewing archived) */}
          {!selectedArchived && (
            <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-900 text-sm">إعدادات ومعايير فترة التصفية</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاريخ بداية الفترة
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاريخ نهاية الفترة
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Calculation Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    طريقة الاحتساب المالي
                  </label>
                  <select
                    value={method}
                    onChange={(e) => handleMethodChange(e.target.value as LiquidationMethod)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="per_session">بسعر الحصة المرجعية (كل 55 د = حصة)</option>
                    <option value="per_hour">بسعر الساعة (كل 60 د = ساعة)</option>
                  </select>
                </div>

                {/* Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {method === 'per_session' ? 'سعر الحصة (55 دقيقة)' : 'سعر الساعة (60 دقيقة)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pl-10"
                    />
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                      {db.settings.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Manual Adjustment & Notes row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تسوية مالية يدوية (اختياري)
                  </label>
                  <input
                    type="number"
                    value={manualAdjustment}
                    onChange={(e) => setManualAdjustment(Number(e.target.value))}
                    placeholder="+ أو - مبلغ تسوية"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    سبب التسوية اليدوية (إن وجدت)
                  </label>
                  <input
                    type="text"
                    value={manualAdjustmentReason}
                    onChange={(e) => setManualAdjustmentReason(e.target.value)}
                    placeholder="مثال: منحة تأطير امتحانات أو خصم مسبق"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات التصفية
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات توضيحية تظهر في الكشف..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Archived record header notice if viewing archived */}
          {selectedArchived && (
            <div className="no-print bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-amber-700 shrink-0" />
                <div className="text-xs text-amber-950">
                  <span className="font-bold">أنت تعرض نسخة مؤرشفة ومعتمدة:</span> تم اعتماد هذه التصفية بتاريخ{' '}
                  <span className="font-mono font-bold">
                    {selectedArchived.approvedAt ? new Date(selectedArchived.approvedAt).toLocaleString('ar-DZ') : '—'}
                  </span>
                  . بيانات هذه النسخة ثابتة ولن تتغير.
                </div>
              </div>
              <button
                onClick={() => setSelectedArchived(null)}
                className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-100"
              >
                العودة للتصفية الحالية
              </button>
            </div>
          )}

          {/* FORMAL LIQUIDATION STATEMENT (Print-ready document) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-6 sm:p-8 space-y-6">
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  كشف التصفية المالية والحسابات الزمنية
                </h2>
                <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                  <div>المؤسسة: مدرسة خاصة متعاقدة</div>
                  <div>
                    فترة التصفية: من{' '}
                    <span className="font-bold">
                      {formatDateArabic(selectedArchived ? selectedArchived.startDate : startDate, false)}
                    </span>{' '}
                    إلى{' '}
                    <span className="font-bold">
                      {formatDateArabic(selectedArchived ? selectedArchived.endDate : endDate, false)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right sm:text-left text-xs text-slate-500">
                <div>تاريخ الإصدار: {new Date().toLocaleDateString('ar-DZ')}</div>
                <div>طريقة الحساب: {(selectedArchived ? selectedArchived.calculationMethod : method) === 'per_session' ? 'سعر الحصة (55 د)' : 'سعر الساعة (60 د)'}</div>
                <div>السعر المعتمد: <span className="font-mono">{selectedArchived ? selectedArchived.rate : rate}</span> {db.settings.currency}</div>
              </div>
            </div>

            {/* Crucial summary cards */}
            {(() => {
              const activeSummary = selectedArchived
                ? {
                    evaluatedWeeksCount: selectedArchived.snapshot.evaluatedWeeksCount,
                    unevaluatedWeeksCount: selectedArchived.snapshot.unevaluatedWeeksCount,
                    approvedRequiredReferenceMinutes: selectedArchived.snapshot.totalRequiredReferenceMinutes,
                    approvedBaseCompletedMinutes: selectedArchived.snapshot.totalBaseCompletedMinutes,
                    approvedExtraCompletedMinutes: selectedArchived.snapshot.totalExtraCompletedMinutes,
                    approvedAbsencesCount: selectedArchived.snapshot.totalAbsencesCount,
                    approvedAbsencesMinutes: selectedArchived.snapshot.totalAbsencesMinutes,
                    approvedDelaysCount: selectedArchived.snapshot.totalDelaysCount,
                    approvedDelaysMinutes: selectedArchived.snapshot.totalDelaysMinutes,
                    approvedNetMinutes: selectedArchived.snapshot.netMinutes,
                    hours: selectedArchived.snapshot.hours,
                    minutes: selectedArchived.snapshot.minutes,
                    equivalentSessions: selectedArchived.snapshot.equivalentSessions,
                    remainderMinutes: selectedArchived.snapshot.remainderMinutes,
                    financialAmount: selectedArchived.snapshot.financialAmount,
                    beneficiary: selectedArchived.snapshot.beneficiary,
                  }
                : summary;

              return (
                <>
                  {/* Notice if un-evaluated weeks are excluded */}
                  {activeSummary.unevaluatedWeeksCount > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <span className="font-bold">تنبيه قانوني:</span> تم استبعاد{' '}
                      <span className="font-bold underline">{activeSummary.unevaluatedWeeksCount} أسبوع</span> غير مُقيّم
                      أو غير معتمد داخل هذه الفترة وفقًا للشرط المحاسبي المانع لاحتساب الأسابيع غير المعتمدة.
                    </div>
                  )}

                  {/* Accounting Breakdown Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-medium">الأسابيع المعتمدة بالتصفية</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">
                        {activeSummary.evaluatedWeeksCount} أسبوع
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-medium">الحجم المرجعي المطلوب</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">
                        <span className="font-mono">{Math.floor(activeSummary.approvedRequiredReferenceMinutes / 60)}</span> س و{' '}
                        <span className="font-mono">{activeSummary.approvedRequiredReferenceMinutes % 60}</span> د
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-medium">الحجم الأساسي المنجز</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">
                        <span className="font-mono">{Math.floor(activeSummary.approvedBaseCompletedMinutes / 60)}</span> س و{' '}
                        <span className="font-mono">{activeSummary.approvedBaseCompletedMinutes % 60}</span> د
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-medium">الحصص الإضافية المنجزة</div>
                      <div className="text-lg font-bold text-indigo-700 mt-1">
                        +<span className="font-mono">{Math.floor(activeSummary.approvedExtraCompletedMinutes / 60)}</span> س و{' '}
                        <span className="font-mono">{activeSummary.approvedExtraCompletedMinutes % 60}</span> د
                      </div>
                    </div>
                  </div>

                  {/* Absences & Delays Summary Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100 p-3 font-bold text-slate-800 border-b border-slate-200">
                      تفصيل أثر الغيابات والتأخرات في الأسابيع المعتمدة
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500">الغيابات الكلية عن الحصص: </span>
                        <span className="font-bold text-rose-600">
                          <span className="font-mono">{activeSummary.approvedAbsencesCount}</span> غياب (مجموع مدتها:{' '}
                          <span className="font-mono">{activeSummary.approvedAbsencesMinutes}</span> دقيقة)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">التأخرات المسجلة: </span>
                        <span className="font-bold text-amber-600">
                          <span className="font-mono">{activeSummary.approvedDelaysCount}</span> تأخر (مجموع مدتها:{' '}
                          <span className="font-mono">{activeSummary.approvedDelaysMinutes}</span> دقيقة)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Final Result Card */}
                  <div
                    className={`p-6 rounded-2xl border-2 ${
                      activeSummary.beneficiary === 'teacher'
                        ? 'bg-emerald-50/70 border-emerald-500'
                        : activeSummary.beneficiary === 'school'
                        ? 'bg-rose-50/70 border-rose-500'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <span
                          className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                            activeSummary.beneficiary === 'teacher'
                              ? 'bg-emerald-600 text-white'
                              : activeSummary.beneficiary === 'school'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-700 text-white'
                          }`}
                        >
                          {activeSummary.beneficiary === 'teacher'
                            ? 'الرصيد النهائي لصالح الأستاذ'
                            : activeSummary.beneficiary === 'school'
                            ? 'الرصيد النهائي لصالح المدرسة (تعويض مطلوب)'
                            : 'الرصيد متعادل تمامًا'}
                        </span>

                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl sm:text-4xl font-black text-slate-900 flex items-baseline gap-1">
                            <span className="font-bold">{activeSummary.approvedNetMinutes >= 0 ? '+' : '-'}</span>
                            <span className="font-mono">{activeSummary.hours}</span>
                            <span className="text-xl font-bold">س</span>
                            <span className="text-lg font-bold text-slate-400">و</span>
                            <span className="font-mono">{activeSummary.minutes}</span>
                            <span className="text-xl font-bold">د</span>
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            ({activeSummary.approvedNetMinutes} دقيقة صافية)
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 font-bold mt-1">
                          المكافئ الحصصي (55 دقيقة لكل حصة): {activeSummary.equivalentSessions} حصص و{' '}
                          {activeSummary.remainderMinutes} دقيقة متبقية
                        </div>
                      </div>

                      <div className="text-right md:text-left border-t md:border-t-0 md:border-r border-slate-300/60 pt-3 md:pt-0 md:pr-6">
                        <div className="text-xs text-slate-500 font-bold">القيمة المالية المستحقة</div>
                        <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono mt-1">
                          {Math.abs(activeSummary.financialAmount).toLocaleString('ar-DZ')}{' '}
                          <span className="text-base font-bold">{db.settings.currency}</span>
                        </div>
                        {selectedArchived?.manualAdjustment ? (
                          <div className="text-2xs text-slate-500 mt-1">
                            (تشمل تسوية يدوية قدرها {selectedArchived.manualAdjustment} {db.settings.currency})
                          </div>
                        ) : manualAdjustment ? (
                          <div className="text-2xs text-slate-500 mt-1">
                            (تشمل تسوية يدوية قدرها {manualAdjustment} {db.settings.currency})
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Signatures for Print */}
                  <div className="pt-8 mt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
                    <div>
                      <div className="font-bold text-slate-700">توقيع ومصادقة الأستاذ</div>
                      <div className="h-16 border-b border-dashed border-slate-300 mt-2" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">ختم ومصادقة إدارة المؤسسة</div>
                      <div className="h-16 border-b border-dashed border-slate-300 mt-2" />
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Action Bar (Save & Approve) */}
            {!selectedArchived && (
              <div className="no-print pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleApproveLiquidation}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد وحفظ التصفية في الأرشيف</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title="تأكيد حذف التصفية من الأرشيف"
        message="هل أنت متأكد من حذف هذا السجل المؤرشف؟"
        confirmLabel="حذف التصفية"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteLiquidation(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
