/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { DailySessionRecord } from '../types/index.ts';
import {
  formatDateArabic,
  formatLocalDate,
  getSaturdayOfWeek,
  getThursdayOfWeek,
  calculateIntervalMinutes,
} from '../utils/dateUtils.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  HelpCircle,
  Filter,
  AlertTriangle,
} from 'lucide-react';

export const ExtraSessionsView: React.FC = () => {
  const { db, saveDailyRecord, deleteDailyRecord, ensureWeekExists } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailySessionRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<string>('all');
  const [filterWeekStatus, setFilterWeekStatus] = useState<string>('all');

  // Form state
  const [date, setDate] = useState<string>(formatLocalDate(new Date()));
  const [sessionType, setSessionType] = useState<'irregular_extra' | 'dated_extra' | 'recurring_support'>('irregular_extra');
  const [subject, setSubject] = useState<string>('حصة دعم إضافية');
  const [groupName, setGroupName] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('16:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // When start or end time changes in form, recalculate duration if both provided
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    if (newStart && newEnd) {
      const diff = calculateIntervalMinutes(newStart, newEnd);
      if (diff > 0) {
        setDurationMinutes(diff);
      }
    }
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setDate(formatLocalDate(new Date()));
    setSessionType('irregular_extra');
    setSubject('حصة دعم إضافية');
    setGroupName('');
    setStartTime('16:00');
    setEndTime('17:00');
    setDurationMinutes(60);
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (rec: DailySessionRecord) => {
    setEditingRecord(rec);
    setDate(rec.date);
    setSessionType(rec.type as any);
    setSubject(rec.subject || '');
    setGroupName(rec.groupName || '');
    setStartTime(rec.scheduledStartTime || '');
    setEndTime(rec.scheduledEndTime || '');
    setDurationMinutes(rec.actualDurationMinutes);
    setNotes(rec.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError('يرجى تحديد تاريخ الحصة.');
      return;
    }
    if (durationMinutes <= 0) {
      setFormError('مدة الحصة الفعلية يجب أن تكون أكبر من 0 دقيقة.');
      return;
    }
    if (durationMinutes > 480) {
      setFormError('مدة الحصة غير منطقية (أكثر من 8 ساعات).');
      return;
    }

    // Duplicate check: check if record with same date, type, subject, and time exists
    const duplicate = db.dailyRecords.find(
      (r) =>
        (!editingRecord || r.id !== editingRecord.id) &&
        r.date === date &&
        r.type === sessionType &&
        r.subject === subject &&
        r.actualDurationMinutes === durationMinutes &&
        r.scheduledStartTime === startTime
    );

    if (duplicate) {
      setFormError('تم تسجيل هذه الحصة بنفس التاريخ والمدة والموضوع مسبقًا لمنع التكرار.');
      return;
    }

    ensureWeekExists(date);

    saveDailyRecord({
      id: editingRecord?.id,
      date,
      type: sessionType,
      subject,
      groupName,
      scheduledStartTime: startTime || undefined,
      scheduledEndTime: endTime || undefined,
      scheduledDurationMinutes: durationMinutes,
      actualDurationMinutes: durationMinutes,
      status: 'present',
      delayMinutes: 0,
      notes,
    });

    setIsModalOpen(false);
  };

  // Filter extra sessions (only non-base sessions)
  const extraRecords = useMemo(() => {
    return db.dailyRecords
      .filter((r) => r.type !== 'base')
      .filter((r) => {
        if (filterType !== 'all' && r.type !== filterType) return false;
        if (filterWeekStatus !== 'all') {
          const sat = getSaturdayOfWeek(r.date);
          const week = db.weeks.find((w) => w.id === `week_${sat}`);
          const status = week ? week.status : 'unreviewed';
          if (filterWeekStatus === 'approved' && status !== 'approved') return false;
          if (filterWeekStatus === 'unreviewed' && status === 'approved') return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.dailyRecords, db.weeks, filterType, filterWeekStatus]);

  // Aggregate totals
  const totalExtraMinutes = useMemo(() => {
    return extraRecords.reduce((sum, r) => sum + r.actualDurationMinutes, 0);
  }, [extraRecords]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            سجل الحصص الإضافية وحصص الدعم
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تسجيل ومتابعة جميع حصص الدعم الإضافية والتعويضية، مع ربطها التلقائي بالأسبوع التابعة له
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حصة إضافية جديدة</span>
        </button>
      </div>

      {/* Rules Notice */}
      <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-950 text-xs">
        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">قاعدة احتساب الحصص الإضافية:</span> الحصص الإضافية التي تنتمي لأسبوع{' '}
          <span className="font-bold underline">مُقيّم ومعتمد</span> تُدمج فورًا في الرصيد الصافي المعتمد.
          أما إذا كان الأسبوع <span className="font-bold underline">غير مُقيّم</span>، فتُعرض الحصة ضمن البيانات المسجلة المؤقتة ولا تُدمج في الرصيد الصافي قبل اعتماد ذلك الأسبوع صراحة.
        </div>
      </div>

      {/* Filters and Stats Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-bold">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>تصفية:</span>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="all">جميع الأنواع</option>
            <option value="irregular_extra">حصص إضافية غير منتظمة</option>
            <option value="recurring_support">حصص دعم ثابتة منجزة</option>
            <option value="dated_extra">حصص مرتبطة بتاريخ محدد</option>
          </select>

          <select
            value={filterWeekStatus}
            onChange={(e) => setFilterWeekStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="all">جميع حالات الأسابيع</option>
            <option value="approved">أسابيع معتمدة فقط (ضمن الرصيد)</option>
            <option value="unreviewed">أسابيع غير معتمدة (مؤقتة)</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-600">
          المجموع المعروض:{' '}
          <span className="text-indigo-600 font-extrabold text-sm font-mono">
            {extraRecords.length} حصة
          </span>{' '}
          ({Math.floor(totalExtraMinutes / 60)} س و {totalExtraMinutes % 60} د = {totalExtraMinutes} دقيقة)
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">التاريخ واليوم</th>
                <th className="p-3.5">نوع الحصة</th>
                <th className="p-3.5">المادة / الفوج</th>
                <th className="p-3.5">الوقت والمدة الفعلية</th>
                <th className="p-3.5">الأسبوع التابع له</th>
                <th className="p-3.5">حالة الاعتماد</th>
                <th className="p-3.5">ملاحظات</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extraRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد حصص إضافية مطابقة للبحث. انقر على «إضافة حصة إضافية جديدة» لتسجيل حصة.
                  </td>
                </tr>
              ) : (
                extraRecords.map((rec) => {
                  const sat = getSaturdayOfWeek(rec.date);
                  const week = db.weeks.find((w) => w.id === `week_${sat}`);
                  const isWeekApproved = week?.status === 'approved';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateArabic(rec.date)}</span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-2xs font-bold ${
                            rec.type === 'recurring_support'
                              ? 'bg-indigo-50 text-indigo-700'
                              : rec.type === 'dated_extra'
                              ? 'bg-teal-50 text-teal-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {rec.type === 'recurring_support'
                            ? 'دعم ثابت'
                            : rec.type === 'dated_extra'
                            ? 'مرتبطة بتاريخ'
                            : 'إضافية غير منتظمة'}
                        </span>
                      </td>

                      <td className="p-3.5 font-medium text-slate-800">
                        <div>{rec.subject || '—'}</div>
                        {rec.groupName && (
                          <div className="text-2xs text-slate-500 mt-0.5">{rec.groupName}</div>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-extrabold text-indigo-700 font-mono text-sm">
                          {rec.actualDurationMinutes} دقيقة
                        </span>
                        {rec.scheduledStartTime && (
                          <span className="text-2xs text-slate-400 block font-mono">
                            {rec.scheduledStartTime} {rec.scheduledEndTime ? `— ${rec.scheduledEndTime}` : ''}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        أسبوع {sat}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {isWeekApproved ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            معتمد بالرصيد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                            <HelpCircle className="w-3 h-3 text-amber-500" />
                            مؤقت (أسبوع غير معتمد)
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-500 max-w-[150px] truncate">
                        {rec.notes || '—'}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(rec)}
                            aria-label="تعديل الحصة"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(rec.id)}
                            aria-label="حذف الحصة"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100">
            <form onSubmit={handleSaveForm}>
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingRecord ? 'تعديل الحصة الإضافية' : 'إضافة حصة إضافية جديدة'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تسجيل الحصة بالمدة الفعلية وربطها التلقائي بالأسبوع
                </p>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاريخ الحصة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {date && (
                    <div className="text-2xs text-slate-500 mt-1">
                      الأسبوع التابع له:{' '}
                      <span className="font-bold text-slate-700">
                        من {formatDateArabic(getSaturdayOfWeek(date), false)} إلى{' '}
                        {formatDateArabic(getThursdayOfWeek(getSaturdayOfWeek(date)), false)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Session Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    نوع الحصة <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="irregular_extra">حصة إضافية غير منتظمة</option>
                    <option value="recurring_support">حصة دعم ثابتة منجزة</option>
                    <option value="dated_extra">حصة تعويضية مرتبطة بتاريخ محدد</option>
                  </select>
                </div>

                {/* Subject and Group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      المادة / الموضوع
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="مثال: رياضيات بكالوريا"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      الفوج / القسم (اختياري)
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="مثال: فوج النخبة"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Time range (optional) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      وقت البداية (اختياري)
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleTimeChange(e.target.value, endTime)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      وقت النهاية (اختياري)
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => handleTimeChange(startTime, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Actual Duration in Minutes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المدة الفعلية المنجزة بالدقائق <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {/* Quick minute buttons */}
                  <div className="flex gap-2 mt-2">
                    {[45, 55, 60, 90, 110, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDurationMinutes(m)}
                        className={`text-2xs font-bold px-2.5 py-1 rounded-md border cursor-pointer ${
                          durationMinutes === m
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {m} د
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات (اختياري)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: تعويض تأخر سابق أو دعم إضافي للامتحانات"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingRecord ? 'حفظ التعديل' : 'تسجيل الحصة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title="تأكيد حذف الحصة الإضافية"
        message="هل أنت متأكد من حذف هذه الحصة الإضافية من السجل؟ سيتم تحديث رصيد الأسبوع المرتبط بها تلقائيًا."
        confirmLabel="حذف الحصة"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteDailyRecord(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
