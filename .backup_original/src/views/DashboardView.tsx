/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculatePeriodSummary } from '../utils/calculationEngine.ts';
import { getSaturdayOfWeek, getThursdayOfWeek, formatDateArabic, formatLocalDate } from '../utils/dateUtils.ts';
import { NavTab } from '../components/Navbar.tsx';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Receipt,
  UserCheck,
  CalendarCheck,
  Info,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
}

type PeriodType = 'current_week' | 'current_month' | 'all_approved' | 'custom';

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { db } = useApp();
  const [periodType, setPeriodType] = useState<PeriodType>('all_approved');

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const currentWeekSat = useMemo(() => getSaturdayOfWeek(todayStr), [todayStr]);
  const currentWeekThu = useMemo(() => getThursdayOfWeek(currentWeekSat), [currentWeekSat]);

  const [customStart, setCustomStart] = useState<string>(currentWeekSat);
  const [customEnd, setCustomEnd] = useState<string>(currentWeekThu);

  // Compute filter dates based on selected period
  const filterDates = useMemo(() => {
    if (periodType === 'current_week') {
      return { startDate: currentWeekSat, endDate: currentWeekThu };
    }
    if (periodType === 'current_month') {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: firstDay,
        endDate: formatLocalDate(lastDay),
      };
    }
    if (periodType === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    return {}; // all_approved
  }, [periodType, currentWeekSat, currentWeekThu, customStart, customEnd]);

  // Calculate period summary with central calculation engine
  const summary = useMemo(() => {
    return calculatePeriodSummary(
      db.weeks,
      db.dailyRecords,
      db.baseSchedule,
      db.settings,
      filterDates
    );
  }, [db.weeks, db.dailyRecords, db.baseSchedule, db.settings, filterDates]);

  // Check if any weeks are pending evaluation
  const unreviewedWeeks = useMemo(() => {
    return db.weeks.filter((w) => w.status !== 'approved');
  }, [db.weeks]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Period Filter */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            لوحة المتابعة والحسابات الزمنية
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ملخص الأرصدة المعتمدة، الحصص المنجزة، والتسويات المالية وفق القواعد المحاسبية الدقيقة
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setPeriodType('all_approved')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'all_approved'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              جميع المعتمد
            </button>
            <button
              onClick={() => setPeriodType('current_month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'current_month'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الشهر الحالي
            </button>
            <button
              onClick={() => setPeriodType('current_week')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'current_week'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الأسبوع الحالي
            </button>
            <button
              onClick={() => setPeriodType('custom')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'custom'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              فترة مخصصة
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Range Selector if selected */}
      {periodType === 'custom' && (
        <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl flex flex-wrap items-center gap-4 text-sm animate-fade-in">
          <span className="font-bold text-indigo-950 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            تحديد الفترة المخصصة:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-slate-600 font-medium">من:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-600 font-medium">إلى:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>
      )}

      {/* Notice Banner if un-evaluated weeks exist */}
      {summary.unevaluatedWeeksCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-sm">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">تنبيه محاسبي هام:</span> يوجد{' '}
            <span className="font-bold underline">{summary.unevaluatedWeeksCount} أسبوع</span> غير مُقيّم أو قيد المراجعة.
            وفقًا لقواعد النظام، هذه الأسابيع <span className="font-bold">مستبعدة تمامًا</span> من الرصيد الصافي المعتمد
            حتى يتم اعتمادها صراحة من صفحة «الأسابيع والتقييم».
          </div>
          <button
            onClick={() => onNavigate('weeks')}
            className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg shrink-0 cursor-pointer"
          >
            مراجعة الأسابيع
          </button>
        </div>
      )}

      {/* Main Metric Cards Grid (8 Cards as requested) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Approved Net Balance (الرصيد الصافي المعتمد) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-12 -translate-y-12 blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-indigo-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              الرصيد الزمني الصافي المعتمد
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                summary.beneficiary === 'teacher'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : summary.beneficiary === 'school'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {summary.beneficiary === 'teacher'
                ? 'لصالح الأستاذ (فائض)'
                : summary.beneficiary === 'school'
                ? 'لصالح المدرسة (نقص مطلوب)'
                : 'رصيد متوازن'}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-4xl lg:text-5xl font-black tracking-tight flex items-baseline gap-1">
              <span className="font-bold">{summary.isPositive ? '+' : '-'}</span>
              <span className="font-mono">{summary.hours}</span>
              <span className="text-2xl font-bold">س</span>
              <span className="text-xl font-bold text-indigo-300">و</span>
              <span className="font-mono">{summary.minutes}</span>
              <span className="text-2xl font-bold">د</span>
            </span>
            <span className="text-indigo-200 text-sm font-medium">
              ({summary.approvedNetMinutes} دقيقة)
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-700/50 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-200">
            <div>
              المكافئ الحصصي (55 د):{' '}
              <span className="font-bold text-white text-sm">
                {summary.formattedSessionsText}
              </span>
            </div>
            {summary.rateApplied > 0 && (
              <div>
                القيمة التقديرية:{' '}
                <span className="font-bold text-amber-300 text-sm">
                  {summary.financialAmount.toLocaleString('ar-DZ')} {db.settings.currency}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Required Reference Volume (الحجم المرجعي المطلوب) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>الحجم المرجعي المطلوب</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">
              {Math.floor(summary.approvedRequiredReferenceMinutes / 60)} س و{' '}
              {summary.approvedRequiredReferenceMinutes % 60} د
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {summary.approvedRequiredReferenceMinutes} دقيقة (
              {summary.evaluatedWeeksCount} × {db.settings.referenceWeeklyHours} ساعة)
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">في الأسابيع المُقيّمة والمعتمدة</div>
        </div>

        {/* Card 3: Base Volume Completed (الحجم الأساسي المنجز) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>الحجم الأساسي المنجز</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">
              {Math.floor(summary.approvedBaseCompletedMinutes / 60)} س و{' '}
              {summary.approvedBaseCompletedMinutes % 60} د
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {summary.approvedBaseCompletedMinutes} دقيقة من الحصص الأساسية
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">حصص الجدول الأساسي الفعلية</div>
        </div>

        {/* Card 4: Extra Hours Completed (الساعات الإضافية المنجزة) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>الحصص الإضافية المنجزة</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">
              {Math.floor(summary.approvedExtraCompletedMinutes / 60)} س و{' '}
              {summary.approvedExtraCompletedMinutes % 60} د
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {summary.approvedExtraCompletedMinutes} دقيقة (دعم وإضافية معتمدة)
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">تغطي الفرق وتعوض الغيابات</div>
        </div>

        {/* Card 5: Absences (الغيابات) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>الغيابات المسجلة</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-rose-600">
              {summary.approvedAbsencesCount} غياب
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              المدة: {Math.floor(summary.approvedAbsencesMinutes / 60)} س و{' '}
              {summary.approvedAbsencesMinutes % 60} د ({summary.approvedAbsencesMinutes} دقيقة)
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">أثر الغياب محسوب دون تكرار</div>
        </div>

        {/* Card 6: Delays (التأخرات) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>التأخرات المسجلة</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-600">
              {summary.approvedDelaysCount} تأخر
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              مجموع التأخر: {summary.approvedDelaysMinutes} دقيقة
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">تسجيل دقيق بالدقائق</div>
        </div>

        {/* Card 7: Evaluated Weeks Count (الأسابيع المُقيّمة) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>الأسابيع المُقيّمة والمعتمدة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">
              {summary.evaluatedWeeksCount} أسبوع
            </div>
            <div className="text-xs text-slate-500 mt-0.5">تدخل في الرصيد الصافي المعتمد</div>
          </div>
          <div className="text-xs text-emerald-600 font-medium">حساب نهائي معتمد</div>
        </div>

        {/* Card 8: Un-evaluated Weeks Count (الأسابيع غير المُقيّمة) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>الأسابيع غير المُقيّمة</span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-700">
              {summary.unevaluatedWeeksCount} أسبوع
            </div>
            <div className="text-xs text-amber-600 mt-0.5 font-medium">
              مستبعدة من الرصيد المعتمد
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            (بياناتها: {summary.unapprovedExtraMinutes} د إضافية مؤقتة)
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span>الإجراءات السريعة</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('daily')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-right group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-900">تسجيل حضور اليوم</div>
            <div className="text-xs text-slate-500 mt-0.5">تسجيل الحصص والغيابات</div>
          </button>

          <button
            onClick={() => onNavigate('extra_sessions')}
            className="p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-right group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-900">إضافة حصة إضافية</div>
            <div className="text-xs text-slate-500 mt-0.5">دعم أو تعويض غير مبرمج</div>
          </button>

          <button
            onClick={() => onNavigate('weeks')}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-right group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-900">تقييم واعتماد أسبوع</div>
            <div className="text-xs text-slate-500 mt-0.5">مراجعة وإدخال في الرصيد</div>
          </button>

          <button
            onClick={() => onNavigate('liquidation')}
            className="p-4 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all text-right group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-900">التصفية المالية</div>
            <div className="text-xs text-slate-500 mt-0.5">حساب المبالغ المستحقة</div>
          </button>
        </div>
      </div>

      {/* Overview Table of Evaluated Weeks */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">ملخص حالة الأسابيع المسجلة</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة حالة الاعتماد والرصيد لكل أسبوع (من السبت إلى الخميس)
            </p>
          </div>
          <button
            onClick={() => onNavigate('weeks')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            عرض التفاصيل
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">الأسبوع</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5">الأساسي المنجز</th>
                <th className="p-3.5">الإضافي المنجز</th>
                <th className="p-3.5">الغيابات</th>
                <th className="p-3.5">التأخرات</th>
                <th className="p-3.5">الرصيد الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.weeks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    لا توجد أسابيع مسجلة بعد. يتم إنشاء الأسابيع تلقائيًا عند تسجيل الحصص.
                  </td>
                </tr>
              ) : (
                db.weeks.map((week) => {
                  const weekMetrics = summary.evaluatedWeekIds.includes(week.id)
                    ? 'approved'
                    : week.status;
                  const isAppr = week.status === 'approved';

                  return (
                    <tr key={week.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        {formatDateArabic(week.startDate, false)} — {formatDateArabic(week.endDate, false)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold ${
                            isAppr
                              ? 'bg-emerald-100 text-emerald-800'
                              : week.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAppr ? 'bg-emerald-600' : week.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}
                          />
                          {isAppr ? 'معتمد ومُقيّم' : week.status === 'in_progress' ? 'قيد المراجعة' : 'غير مُقيّم'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {/* We calculate quick per-week stats */}
                        {isAppr ? 'محسوب في المعتمد' : 'مؤقت'}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {isAppr ? 'معتمد' : 'مستبعد حالياً'}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {isAppr ? 'محسوب' : 'مؤقت'}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {isAppr ? 'محسوب' : 'مؤقت'}
                      </td>
                      <td className="p-3.5 font-bold whitespace-nowrap">
                        {isAppr ? (
                          <span className="text-indigo-600">معتمد في الرصيد</span>
                        ) : (
                          <span className="text-slate-400 text-2xs">غير مدرج بالرصيد</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
