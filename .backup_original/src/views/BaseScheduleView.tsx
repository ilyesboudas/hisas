/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { BaseScheduleItem } from '../types/index.ts';
import {
  DAY_NAMES_ARABIC,
  WEEK_DAYS_ORDER,
  calculateIntervalMinutes,
  checkTimeOverlap,
} from '../utils/dateUtils.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  Plus,
  Trash2,
  Edit2,
  Clock,
  BookOpen,
  Users,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export const BaseScheduleView: React.FC = () => {
  const { db, addBaseScheduleItem, updateBaseScheduleItem, deleteBaseScheduleItem } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseScheduleItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields
  const [dayOfWeek, setDayOfWeek] = useState<number>(6); // Saturday
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('08:55');
  const [subject, setSubject] = useState<string>('رياضيات');
  const [gradeClass, setGradeClass] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Calculated duration
  const currentDuration = useMemo(() => {
    return calculateIntervalMinutes(startTime, endTime);
  }, [startTime, endTime]);

  // Total programmed volume
  const totalProgrammedMinutes = useMemo(() => {
    return db.baseSchedule
      .filter((item) => item.isActive)
      .reduce((sum, item) => sum + item.durationMinutes, 0);
  }, [db.baseSchedule]);

  const targetMinutes = db.settings.targetBaseWeeklyHours * 60; // 14 * 60 = 840 min
  const programmedHours = Math.floor(totalProgrammedMinutes / 60);
  const programmedRemainderMinutes = totalProgrammedMinutes % 60;

  const openAddModal = (defaultDay?: number) => {
    setEditingItem(null);
    setDayOfWeek(defaultDay !== undefined ? defaultDay : 6);
    setStartTime('08:00');
    setEndTime('08:55');
    setSubject('رياضيات');
    setGradeClass('');
    setNotes('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: BaseScheduleItem) => {
    setEditingItem(item);
    setDayOfWeek(item.dayOfWeek);
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setSubject(item.subject || '');
    setGradeClass(item.gradeClass || '');
    setNotes(item.notes || '');
    setIsActive(item.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const duration = calculateIntervalMinutes(startTime, endTime);
    if (duration <= 0) {
      setFormError('وقت نهاية الحصة يجب أن يكون بعد وقت البداية بشكل منطقي.');
      return;
    }
    if (duration > 300) {
      setFormError('مدة الحصة تتجاوز 5 ساعات، يرجى التحقق من أوقات الحصة.');
      return;
    }

    // Check overlap with other active sessions on same day
    const otherItems = db.baseSchedule.filter(
      (item) =>
        item.isActive &&
        item.dayOfWeek === dayOfWeek &&
        (!editingItem || item.id !== editingItem.id)
    );

    for (const other of otherItems) {
      if (checkTimeOverlap(startTime, endTime, other.startTime, other.endTime)) {
        setFormError(
          `يوجد تداخل زمني مع حصة أخرى في نفس اليوم (${other.subject || 'حصة'} من ${other.startTime} إلى ${other.endTime}).`
        );
        return;
      }
    }

    if (editingItem) {
      updateBaseScheduleItem({
        ...editingItem,
        dayOfWeek,
        startTime,
        endTime,
        durationMinutes: duration,
        subject,
        gradeClass,
        notes,
        isActive,
      });
    } else {
      addBaseScheduleItem({
        dayOfWeek,
        startTime,
        endTime,
        durationMinutes: duration,
        subject,
        gradeClass,
        notes,
        isActive,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            جدول الحصص الأساسية الأسبوعية
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تعريف الجدول الأسبوعي النظامي للأستاذ (من السبت إلى الخميس، والجمعة عطلة أسبوعية)
          </p>
        </div>

        <button
          onClick={() => openAddModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حصة جديدة</span>
        </button>
      </div>

      {/* Programmed Volume Alert Card */}
      <div
        className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          totalProgrammedMinutes === targetMinutes
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : totalProgrammedMinutes < targetMinutes
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-blue-50/80 border-blue-200 text-blue-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {totalProgrammedMinutes === targetMinutes ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-extrabold text-base">
              الحجم الأسبوعي المبرمج في الجدول: {programmedHours} س و {programmedRemainderMinutes} د ({totalProgrammedMinutes} دقيقة)
            </div>
            <div className="text-xs mt-1 text-slate-600">
              الحجم الأساسي المستهدف في الإعدادات:{' '}
              <span className="font-bold">{db.settings.targetBaseWeeklyHours} ساعة</span> (
              {targetMinutes} دقيقة) — الفرق عن الحجم المرجعي (16 ساعة):{' '}
              <span className="font-bold">
                {db.settings.referenceWeeklyHours - db.settings.targetBaseWeeklyHours} ساعات أسبوعيًا
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/80 border shadow-2xs whitespace-nowrap">
          {totalProgrammedMinutes === targetMinutes ? (
            <span className="text-emerald-700">الجدول مطابق تمامًا للحجم المستهدف</span>
          ) : totalProgrammedMinutes < targetMinutes ? (
            <span className="text-amber-700">
              الجدول أقل من المستهدف بـ {targetMinutes - totalProgrammedMinutes} دقيقة
            </span>
          ) : (
            <span className="text-blue-700">
              الجدول يتجاوز المستهدف بـ {totalProgrammedMinutes - targetMinutes} دقيقة
            </span>
          )}
        </div>
      </div>

      {/* Weekly Schedule Grid by Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {WEEK_DAYS_ORDER.map((day) => {
          const dayName = DAY_NAMES_ARABIC[day];
          const sessions = db.baseSchedule
            .filter((item) => item.dayOfWeek === day)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          const dayMinutes = sessions
            .filter((s) => s.isActive)
            .reduce((sum, s) => sum + s.durationMinutes, 0);

          return (
            <div
              key={day}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between overflow-hidden"
            >
              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span className="font-extrabold text-slate-900 text-sm">{dayName}</span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {sessions.length} حصص ({dayMinutes} دقيقة)
                </div>
              </div>

              <div className="p-3.5 space-y-2.5 flex-1 min-h-[140px]">
                {sessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
                    <span>لا توجد حصص مبرمجة في هذا اليوم</span>
                    <button
                      onClick={() => openAddModal(day)}
                      className="mt-2 text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة حصة
                    </button>
                  </div>
                ) : (
                  sessions.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all ${
                        item.isActive
                          ? 'bg-slate-50/60 border-slate-200 hover:border-indigo-300'
                          : 'bg-slate-100/50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{item.subject || 'حصة تدريس'}</span>
                          </div>
                          {item.gradeClass && (
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{item.gradeClass}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            aria-label="تعديل الحصة"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-white cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            aria-label="حذف الحصة"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {item.startTime} — {item.endTime}
                          </span>
                        </div>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {item.durationMinutes} دقيقة
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {sessions.length > 0 && (
                <div className="p-2.5 bg-slate-50/50 border-t border-slate-100 text-center">
                  <button
                    onClick={() => openAddModal(day)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 w-full py-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة حصة ليوم {dayName}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Friday Holiday Notice Card */}
      <div className="bg-slate-100/80 border border-slate-200 p-4 rounded-2xl flex items-center gap-3 text-slate-600 text-xs">
        <HelpCircle className="w-5 h-5 text-slate-400 shrink-0" />
        <div>
          <span className="font-bold text-slate-800">يوم الجمعة عطلة أسبوعية:</span> لا يُدرج يوم الجمعة في الجدول
          الأساسي العادي تلقائيًا. في حال تدريس حصة استثنائية يوم الجمعة، يمكن تسجيلها من خلال نافذة «التسجيل اليومي» أو «الحصص الإضافية».
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
                  {editingItem ? 'تعديل حصة أساسية' : 'إضافة حصة أساسية إلى الجدول'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  أدخل أوقات وبيانات الحصة وفق الجدول المعتمد
                </p>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Day Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    يوم الحصة <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {WEEK_DAYS_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {DAY_NAMES_ARABIC[d]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      وقت البداية <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      وقت النهاية <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Calculated Duration Display */}
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
                  <span className="text-indigo-900 font-bold">المدة المحسوبة تلقائيًا:</span>
                  <span className="font-extrabold text-indigo-700 text-sm">
                    {currentDuration > 0 ? `${currentDuration} دقيقة` : 'أوقات غير صالحة'}
                  </span>
                </div>

                {/* Subject & Class */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      المادة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="مثال: رياضيات"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      القسم / الفوج (اختياري)
                    </label>
                    <input
                      type="text"
                      value={gradeClass}
                      onChange={(e) => setGradeClass(e.target.value)}
                      placeholder="مثال: 3 ثانوي علوم تجريبية"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
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
                    placeholder="مثال: قاعة 4 / حصة نصف فوج"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    تفعيل الحصة في الجدول الأسبوعي
                  </label>
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
                  {editingItem ? 'حفظ التعديل' : 'إضافة الحصة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title="تأكيد حذف الحصة من الجدول"
        message="هل أنت متأكد من حذف هذه الحصة من الجدول الأساسي؟ لن يتم حذف أي سجلات حضور قديمة تم تسجيلها بناءً عليها سابقًا."
        confirmLabel="حذف الحصة"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteBaseScheduleItem(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
