/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { WeekRecord, DailySessionRecord } from '../types/index.ts';
import { calculateWeekMetrics, convertMinutesToSessions } from '../utils/calculationEngine.ts';
import { formatDateArabic, getSaturdayOfWeek, getThursdayOfWeek } from '../utils/dateUtils.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  Eye,
  FileCheck,
  AlertTriangle,
  History,
  Info,
} from 'lucide-react';

export const WeeksView: React.FC = () => {
  const { db, approveWeek, reopenWeek, updateWeekStatus } = useApp();

  const [reviewWeek, setReviewWeek] = useState<WeekRecord | null>(null);
  const [approveConfirmWeek, setApproveConfirmWeek] = useState<WeekRecord | null>(null);
  const [reopenTargetWeek, setReopenTargetWeek] = useState<WeekRecord | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Compute metrics for each week
  const weekList = useMemo(() => {
    return db.weeks
      .map((week) => {
        const metrics = calculateWeekMetrics(week, db.dailyRecords, db.baseSchedule, db.settings);
        const conversion = convertMinutesToSessions(metrics.isApproved ? metrics.netMinutes : metrics.provisionalNetMinutes);
        return {
          week,
          metrics,
          conversion,
        };
      })
      .sort((a, b) => b.week.startDate.localeCompare(a.week.startDate));
  }, [db.weeks, db.dailyRecords, db.baseSchedule, db.settings]);

  // Review drawer/modal records for reviewWeek
  const reviewRecords = useMemo(() => {
    if (!reviewWeek) return [];
    return db.dailyRecords
      .filter((r) => r.date >= reviewWeek.startDate && r.date <= reviewWeek.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [db.dailyRecords, reviewWeek]);

  const handleConfirmReopen = () => {
    if (!reopenReason.trim()) {
      setReopenError('يرجى كتابة سبب إعادة فتح الأسبوع للتصحيح.');
      return;
    }
    if (reopenTargetWeek) {
      reopenWeek(reopenTargetWeek.id, reopenReason.trim());
      setReopenTargetWeek(null);
      setReopenReason('');
      setReopenError(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            إدارة وتقييم واعتماد الأسابيع
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            مراجعة الحصص المنفذة والغيابات، واعتماد الأسابيع لإدخالها في الرصيد الصافي النهائي
          </p>
        </div>
      </div>

      {/* Rules Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3 text-indigo-950 text-xs">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">القاعدة الحاسمة في النظام:</span> لا تحتسب أي ساعات أسبوعية نهائية أو ساعات ناقصة للتعويض إلا بعد تقييم الأسبوع واعتماده صراحة. مجرد انقضاء يوم الخميس لا يعتمد الأسبوع تلقائيًا.
        </div>
      </div>

      {/* Weeks Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">فترة الأسبوع (السبت - الخميس)</th>
                <th className="p-3.5">حالة الأسبوع</th>
                <th className="p-3.5">الأساسي المقرّر / المنجز</th>
                <th className="p-3.5">الغيابات والتأخرات</th>
                <th className="p-3.5">الحصص الإضافية</th>
                <th className="p-3.5">الرصيد الزمني</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weekList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا توجد أسابيع مسجلة بعد. عند تسجيل الحصص في «التسجيل اليومي»، سيتم إنشاء الأسبوع تلقائيًا.
                  </td>
                </tr>
              ) : (
                weekList.map(({ week, metrics, conversion }) => {
                  const isApproved = week.status === 'approved';

                  return (
                    <tr key={week.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Week Period */}
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {formatDateArabic(week.startDate, false)} — {formatDateArabic(week.endDate, false)}
                          </span>
                        </div>
                        {week.approvalDate && (
                          <div className="text-2xs text-emerald-600 font-medium mt-0.5">
                            اعتمد بتاريخ: {new Date(week.approvalDate).toLocaleDateString('ar-DZ')}
                          </div>
                        )}
                        {week.reopenReason && !isApproved && (
                          <div className="text-2xs text-amber-600 font-medium mt-0.5">
                            أُعيد فتحه: {week.reopenReason}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-extrabold ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800'
                              : week.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isApproved ? 'bg-emerald-600' : week.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}
                          />
                          {isApproved
                            ? 'مُقيّم ومعتمد'
                            : week.status === 'in_progress'
                            ? 'قيد المراجعة'
                            : 'غير مُقيّم'}
                        </span>
                      </td>

                      {/* Programmed vs Completed Base */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">
                          {metrics.completedBaseMinutes} د / {metrics.scheduledBaseMinutes} د
                        </div>
                        <div className="text-2xs text-slate-400 mt-0.5">
                          ({Math.floor(metrics.completedBaseMinutes / 60)} س و {metrics.completedBaseMinutes % 60} د منجز)
                        </div>
                      </td>

                      {/* Absences & Delays */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              metrics.absencesCount > 0 ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          >
                            {metrics.absencesCount} غياب ({metrics.absencesMinutes} د)
                          </span>
                          <span className="text-slate-300">•</span>
                          <span
                            className={`font-bold ${
                              metrics.delaysCount > 0 ? 'text-amber-600' : 'text-slate-400'
                            }`}
                          >
                            {metrics.delaysCount} تأخر ({metrics.delaysMinutes} د)
                          </span>
                        </div>
                      </td>

                      {/* Extra sessions */}
                      <td className="p-3.5 whitespace-nowrap font-bold text-indigo-700">
                        {metrics.completedExtraMinutes > 0 ? (
                          <span>+{metrics.completedExtraMinutes} دقيقة</span>
                        ) : (
                          <span className="text-slate-400 font-normal">0 دقيقة</span>
                        )}
                      </td>

                      {/* Net Balance */}
                      <td className="p-3.5 whitespace-nowrap">
                        {isApproved ? (
                          <div>
                            <span
                              className={`font-black text-sm flex items-center gap-0.5 ${
                                metrics.netMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              <span>{conversion.isPositive ? '+' : '-'}</span>
                              <span className="font-mono">{conversion.hours}</span>
                              <span>س</span>
                              <span className="text-slate-400">و</span>
                              <span className="font-mono">{conversion.minutes}</span>
                              <span>د</span>
                            </span>
                            <div className="text-2xs text-slate-500 font-bold">
                              ({conversion.formattedSessionsText})
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-400 text-xs font-medium line-through flex items-center gap-0.5">
                              <span>{conversion.isPositive ? '+' : '-'}</span>
                              <span className="font-mono">{conversion.hours}</span>
                              <span>س و </span>
                              <span className="font-mono">{conversion.minutes}</span>
                              <span>د</span>
                            </span>
                            <div className="text-2xs text-amber-600 font-bold">
                              (مستبعد - يلزم الاعتماد)
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setReviewWeek(week)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>مراجعة</span>
                          </button>

                          {!isApproved ? (
                            <button
                              onClick={() => setApproveConfirmWeek(week)}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>اعتماد الأسبوع</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setReopenTargetWeek(week);
                                setReopenReason('');
                                setReopenError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                              <span>إعادة فتح</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {reviewWeek && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  تفاصيل حصص الأسبوع: {formatDateArabic(reviewWeek.startDate, false)} إلى{' '}
                  {formatDateArabic(reviewWeek.endDate, false)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  كشف جميع الحصص الأساسية والإضافية المسجلة خلال هذا الأسبوع
                </p>
              </div>
              <button
                onClick={() => setReviewWeek(null)}
                aria-label="إغلاق"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {reviewRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  لا توجد سجلات حضور أو حصص إضافية مسجلة لهذا الأسبوع حتى الآن.
                </div>
              ) : (
                reviewRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs bg-slate-50/50"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{formatDateArabic(rec.date)}</span>
                        <span className="text-slate-400">•</span>
                        <span>{rec.subject || (rec.type === 'base' ? 'حصة أساسية' : 'حصة إضافية')}</span>
                      </div>
                      <div className="text-2xs text-slate-500 mt-0.5">
                        {rec.type === 'base' ? 'حصة أساسية' : 'حصة دعم / إضافية'}
                        {rec.notes ? ` — ${rec.notes}` : ''}
                      </div>
                    </div>

                    <div className="text-left whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-2xs font-bold ${
                          rec.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'absent'
                            ? 'bg-rose-100 text-rose-800'
                            : rec.status === 'late'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {rec.status === 'present'
                          ? `حاضر (${rec.actualDurationMinutes} د)`
                          : rec.status === 'absent'
                          ? `غائب (${rec.scheduledDurationMinutes} د)`
                          : rec.status === 'late'
                          ? `متأخر ${rec.delayMinutes} د (منجز ${rec.actualDurationMinutes} د)`
                          : 'ملغاة'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-between border-t border-slate-100">
              <div className="text-xs text-slate-500">
                حالة الأسبوع الحالية:{' '}
                <span className="font-bold text-slate-800">
                  {reviewWeek.status === 'approved' ? 'معتمد' : 'غير معتمد'}
                </span>
              </div>
              <button
                onClick={() => setReviewWeek(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Week Confirmation */}
      <ConfirmModal
        isOpen={Boolean(approveConfirmWeek)}
        title="تأكيد اعتماد الأسبوع"
        message={`هل تأكدت من مراجعة جميع حصص الأسبوع [${approveConfirmWeek?.startDate} إلى ${approveConfirmWeek?.endDate}]؟ عند الاعتماد، سيتم إدخال رصيد هذا الأسبوع بصورة نهائية في الرصيد الصافي المعتمد.`}
        confirmLabel="نعم، اعتمد الأسبوع"
        variant="primary"
        onConfirm={() => {
          if (approveConfirmWeek) {
            approveWeek(approveConfirmWeek.id);
            setApproveConfirmWeek(null);
          }
        }}
        onCancel={() => setApproveConfirmWeek(null)}
      />

      {/* Reopen Week Modal with Required Reason */}
      {reopenTargetWeek && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                إعادة فتح الأسبوع للتصحيح
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                الفترة: {reopenTargetWeek.startDate} إلى {reopenTargetWeek.endDate}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                إعادة فتح الأسبوع ستستبعد رصيده مؤقتًا من الرصيد الصافي المعتمد لحين مراجعته وإعادة اعتماده.
              </div>

              {reopenError && (
                <div className="text-xs text-rose-600 font-bold">{reopenError}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سبب إعادة الفتح والتصحيح (مطلوب) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="مثال: تصحيح غياب يوم الاثنين وإضافة حصة دعم تعويضية..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReopenTargetWeek(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                className="px-5 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                تأكيد إعادة الفتح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
