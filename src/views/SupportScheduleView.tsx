/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { SupportScheduleItem } from '../types/index.ts';
import { DAY_NAMES_ARABIC, WEEK_DAYS_ORDER, formatLocalDate } from '../utils/dateUtils.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  Plus,
  Trash2,
  Edit2,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  PowerOff,
  Power,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';

export const SupportScheduleView: React.FC = () => {
  const {
    db,
    addSupportScheduleItem,
    updateSupportScheduleItem,
    deleteSupportScheduleItem,
    saveDailyRecord,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupportScheduleItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Quick Log Modal State
  const [quickLogItem, setQuickLogItem] = useState<SupportScheduleItem | null>(null);
  const [logDate, setLogDate] = useState<string>(formatLocalDate(new Date()));
  const [logMinutes, setLogMinutes] = useState<number>(60);
  const [logNotes, setLogNotes] = useState<string>('');

  // Form State
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [startTime, setStartTime] = useState<string>('15:00');
  const [subject, setSubject] = useState<string>('دعم رياضيات');
  const [groupName, setGroupName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const openAddModal = () => {
    setEditingItem(null);
    setDayOfWeek(1);
    setStartTime('15:00');
    setSubject('دعم رياضيات');
    setGroupName('');
    setNotes('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: SupportScheduleItem) => {
    setEditingItem(item);
    setDayOfWeek(item.dayOfWeek);
    setStartTime(item.startTime || '15:00');
    setSubject(item.subject || '');
    setGroupName(item.groupName || '');
    setNotes(item.notes || '');
    setIsActive(item.isActive);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateSupportScheduleItem({
        ...editingItem,
        dayOfWeek,
        startTime,
        subject,
        groupName,
        notes,
        isActive,
      });
    } else {
      addSupportScheduleItem({
        dayOfWeek,
        startTime,
        subject,
        groupName,
        notes,
        isActive,
      });
    }
    setIsModalOpen(false);
  };

  const handleQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLogItem) return;

    if (logMinutes <= 0) {
      return;
    }

    saveDailyRecord({
      date: logDate,
      type: 'recurring_support',
      supportScheduleId: quickLogItem.id,
      subject: quickLogItem.subject,
      groupName: quickLogItem.groupName,
      scheduledStartTime: quickLogItem.startTime,
      scheduledDurationMinutes: logMinutes,
      actualDurationMinutes: logMinutes,
      status: 'present',
      delayMinutes: 0,
      notes: logNotes || quickLogItem.notes,
    });

    setQuickLogItem(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            حصص الدعم الثابتة أسبوعيًا
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تعريف الأفواج وحصص الدعم المتكررة. المدة الفعلية متغيرة وتسجل بالدقائق الحقيقية بعد إنجاز الحصة.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حصة دعم ثابتة</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3 text-indigo-950 text-xs">
        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">قاعدة إدارة حصص الدعم:</span> لا يُلزم النظام بتحديد مدة ثابتة عند إعداد الجدول، لأن مدة الدعم تختلف بحسب المنجز الفعلي. عند تسجيل إنجاز الحصة، تُضاف مدتها بالدقائق مباشرة إلى سجل الحصص الإضافية وترتبط بالأسبوع الذي تنتمي إليه.
        </div>
      </div>

      {/* Support Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {db.supportSchedule.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">لا توجد حصص دعم ثابتة مسجلة</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              يمكنك إضافة حصص الدعم الأسبوعية المتكررة هنا لتسجيلها بضغطة زر عند إنجازها
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة حصة دعم الآن
            </button>
          </div>
        ) : (
          db.supportSchedule.map((item) => {
            const dayName = DAY_NAMES_ARABIC[item.dayOfWeek];
            // Count how many times this support session has been completed in records
            const completedCount = db.dailyRecords.filter(
              (r) => r.supportScheduleId === item.id && r.actualDurationMinutes > 0
            ).length;
            const completedMinutesTotal = db.dailyRecords
              .filter((r) => r.supportScheduleId === item.id)
              .reduce((sum, r) => sum + r.actualDurationMinutes, 0);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between shadow-xs ${
                  item.isActive ? 'border-slate-200/90' : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg mb-2">
                        كل {dayName} {item.startTime ? `(الساعة ${item.startTime})` : ''}
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>{item.subject || 'حصة دعم'}</span>
                      </h3>
                      {item.groupName && (
                        <div className="text-xs text-slate-600 flex items-center gap-1 mt-1 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.groupName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateSupportScheduleItem({ ...item, isActive: !item.isActive })
                        }
                        title={item.isActive ? 'تعطيل الحصة مؤقتًا' : 'تفعيل الحصة'}
                        aria-label={item.isActive ? 'تعطيل الحصة مؤقتًا' : 'تفعيل الحصة'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          item.isActive
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {item.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        aria-label="تعديل الحصة"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        aria-label="حذف الحصة"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                      {item.notes}
                    </p>
                  )}

                  {/* Completion stats */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>عدد مرات الإنجاز:</span>
                    <span className="font-bold text-slate-800">
                      {completedCount} مرة ({completedMinutesTotal} دقيقة)
                    </span>
                  </div>
                </div>

                {/* Quick Log Action */}
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setQuickLogItem(item);
                      setLogDate(formatLocalDate(new Date()));
                      setLogMinutes(item.defaultDurationMinutes || 60);
                      setLogNotes('');
                    }}
                    disabled={!item.isActive}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>تسجيل إنجاز هذه الحصة اليوم</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
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
                  {editingItem ? 'تعديل حصة الدعم الثابتة' : 'إضافة حصة دعم أسبوعية ثابتة'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعريف الحصة المتكررة مع إمكانية إدخال المدة الحقيقية عند الإنجاز
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    يوم الحصة الأسبوعي <span className="text-rose-500">*</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      وقت البداية التقديري (اختياري)
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اسم المادة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="مثال: رياضيات بكالوريا"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم الفوج / القسم (اختياري)
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="مثال: فوج النخبة (3 ع ت)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات (اختياري)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: مراجعة دورية وتمارين مكثفة"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="suppIsActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                  <label htmlFor="suppIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    تفعيل الحصة الأسبوعية
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

      {/* Quick Log Completion Modal */}
      {quickLogItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <form onSubmit={handleQuickLog}>
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">
                  تسجيل إنجاز حصة دعم: {quickLogItem.subject}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  أدخل المدة المنجزة بالدقائق والتاريخ
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاريخ إنجاز الحصة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المدة المنجزة فعليًا (بالدقائق) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <div className="flex gap-2 mt-2">
                    {[45, 55, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLogMinutes(m)}
                        className={`text-2xs font-bold px-2 py-1 rounded-md border cursor-pointer ${
                          logMinutes === m
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {m} د
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات الإنجاز (اختياري)
                  </label>
                  <input
                    type="text"
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="مثال: تم إكمال درس المتتاليات"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickLogItem(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ وتسجيل الحصة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title="تأكيد حذف حصة الدعم الثابتة"
        message="هل أنت متأكد من حذف حصة الدعم هذه؟ لن يؤثر الحذف على سجلات الحصص المنجزة سابقًا."
        confirmLabel="حذف الحصة"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteSupportScheduleItem(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
