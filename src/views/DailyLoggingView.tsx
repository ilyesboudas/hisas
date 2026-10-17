/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { DailySessionRecord, AttendanceStatus } from '../types/index.ts';
import {
  parseLocalDate,
  formatLocalDate,
  formatDateArabic,
  DAY_NAMES_ARABIC,
} from '../utils/dateUtils.ts';
import {
  Calendar,
  CalendarCheck,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  HelpCircle,
  Plus,
  BookOpen,
  Users,
  Save,
  Sparkles,
} from 'lucide-react';

export const DailyLoggingView: React.FC = () => {
  const {
    db,
    saveDailyRecord,
    batchSaveDailyRecords,
    ensureWeekExists,
    showToast,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDate(new Date()));

  // Active day of week for selected date
  const dayOfWeek = useMemo(() => {
    return parseLocalDate(selectedDate).getDay();
  }, [selectedDate]);

  // Base sessions scheduled for this day of week
  const baseScheduledForDay = useMemo(() => {
    return db.baseSchedule
      .filter((item) => item.isActive && item.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [db.baseSchedule, dayOfWeek]);

  // Support sessions scheduled for this day of week
  const supportScheduledForDay = useMemo(() => {
    return db.supportSchedule
      .filter((item) => item.isActive && item.dayOfWeek === dayOfWeek);
  }, [db.supportSchedule, dayOfWeek]);

  // Existing records for this date in database
  const existingRecordsForDate = useMemo(() => {
    return db.dailyRecords.filter((r) => r.date === selectedDate);
  }, [db.dailyRecords, selectedDate]);

  // Exceptional / standalone extra sessions for this date
  const datedExtraSessions = useMemo(() => {
    return existingRecordsForDate.filter(
      (r) => !r.baseScheduleId && !r.supportScheduleId
    );
  }, [existingRecordsForDate]);

  // Local state form for editing base records before saving
  // Map of baseScheduleId -> draft record
  const [baseDrafts, setBaseDrafts] = useState<Record<string, {
    status: AttendanceStatus;
    delayMinutes: number;
    actualDurationMinutes: number;
    notes: string;
  }>>({});

  // Local state for support sessions on this day
  const [supportDrafts, setSupportDrafts] = useState<Record<string, {
    completed: boolean;
    durationMinutes: number;
    notes: string;
  }>>({});

  // Exceptional session modal
  const [isExceptionalModalOpen, setIsExceptionalModalOpen] = useState(false);
  const [exceptionalSubject, setExceptionalSubject] = useState('حصة استثنائية');
  const [exceptionalDuration, setExceptionalDuration] = useState(55);
  const [exceptionalNotes, setExceptionalNotes] = useState('');

  // Sync draft states whenever selectedDate or existing records change
  useEffect(() => {
    // Populate base drafts
    const newBaseDrafts: Record<string, any> = {};
    for (const baseItem of baseScheduledForDay) {
      const existing = existingRecordsForDate.find((r) => r.baseScheduleId === baseItem.id);
      if (existing) {
        newBaseDrafts[baseItem.id] = {
          status: existing.status,
          delayMinutes: existing.delayMinutes || 0,
          actualDurationMinutes: existing.actualDurationMinutes || baseItem.durationMinutes,
          notes: existing.notes || '',
        };
      } else {
        newBaseDrafts[baseItem.id] = {
          status: 'present' as AttendanceStatus, // Default to present
          delayMinutes: 0,
          actualDurationMinutes: baseItem.durationMinutes,
          notes: '',
        };
      }
    }
    setBaseDrafts(newBaseDrafts);

    // Populate support drafts
    const newSupportDrafts: Record<string, any> = {};
    for (const suppItem of supportScheduledForDay) {
      const existing = existingRecordsForDate.find((r) => r.supportScheduleId === suppItem.id);
      if (existing) {
        newSupportDrafts[suppItem.id] = {
          completed: existing.actualDurationMinutes > 0,
          durationMinutes: existing.actualDurationMinutes || suppItem.defaultDurationMinutes || 60,
          notes: existing.notes || '',
        };
      } else {
        newSupportDrafts[suppItem.id] = {
          completed: false,
          durationMinutes: suppItem.defaultDurationMinutes || 60,
          notes: '',
        };
      }
    }
    setSupportDrafts(newSupportDrafts);
  }, [selectedDate, baseScheduledForDay, supportScheduledForDay, existingRecordsForDate]);

  // Date navigation helpers
  const shiftDate = (days: number) => {
    const current = parseLocalDate(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(formatLocalDate(current));
  };

  const handleSaveAllForToday = () => {
    ensureWeekExists(selectedDate);

    const recordsToSave: (Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string })[] = [];

    // 1. Base schedule records
    for (const baseItem of baseScheduledForDay) {
      const draft = baseDrafts[baseItem.id];
      if (!draft) continue;

      const existing = existingRecordsForDate.find((r) => r.baseScheduleId === baseItem.id);

      let actualDuration = 0;
      if (draft.status === 'present') {
        actualDuration = draft.actualDurationMinutes || baseItem.durationMinutes;
      } else if (draft.status === 'late') {
        actualDuration = Math.max(0, baseItem.durationMinutes - draft.delayMinutes);
      } else if (draft.status === 'cancelled_by_school') {
        actualDuration = baseItem.durationMinutes;
      } else {
        actualDuration = 0; // absent
      }

      recordsToSave.push({
        id: existing?.id,
        date: selectedDate,
        type: 'base',
        baseScheduleId: baseItem.id,
        subject: baseItem.subject,
        groupName: baseItem.gradeClass,
        scheduledStartTime: baseItem.startTime,
        scheduledEndTime: baseItem.endTime,
        scheduledDurationMinutes: baseItem.durationMinutes,
        actualDurationMinutes: actualDuration,
        status: draft.status,
        delayMinutes: draft.status === 'late' ? draft.delayMinutes : 0,
        notes: draft.notes,
      });
    }

    // 2. Support schedule records
    for (const suppItem of supportScheduledForDay) {
      const draft = supportDrafts[suppItem.id];
      if (!draft) continue;

      const existing = existingRecordsForDate.find((r) => r.supportScheduleId === suppItem.id);

      if (draft.completed) {
        recordsToSave.push({
          id: existing?.id,
          date: selectedDate,
          type: 'recurring_support',
          supportScheduleId: suppItem.id,
          subject: suppItem.subject,
          groupName: suppItem.groupName,
          scheduledStartTime: suppItem.startTime,
          scheduledDurationMinutes: draft.durationMinutes,
          actualDurationMinutes: draft.durationMinutes,
          status: 'present',
          delayMinutes: 0,
          notes: draft.notes,
        });
      } else if (existing) {
        // If it was previously saved but now unmarked, mark with 0 duration
        recordsToSave.push({
          id: existing.id,
          date: selectedDate,
          type: 'recurring_support',
          supportScheduleId: suppItem.id,
          subject: suppItem.subject,
          groupName: suppItem.groupName,
          scheduledDurationMinutes: 0,
          actualDurationMinutes: 0,
          status: 'unrecorded',
          delayMinutes: 0,
          notes: draft.notes,
        });
      }
    }

    batchSaveDailyRecords(recordsToSave);
  };

  const handleAddExceptionalSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (exceptionalDuration <= 0) return;

    ensureWeekExists(selectedDate);
    saveDailyRecord({
      date: selectedDate,
      type: 'dated_extra',
      subject: exceptionalSubject,
      scheduledDurationMinutes: exceptionalDuration,
      actualDurationMinutes: exceptionalDuration,
      status: 'present',
      delayMinutes: 0,
      notes: exceptionalNotes,
    });

    setIsExceptionalModalOpen(false);
    setExceptionalNotes('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Date Picker Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            نافذة التسجيل اليومي للحصص
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تسجيل الحضور والغيابات والتأخرات بالدقائق، وتدوين حصص الدعم المنجزة
          </p>
        </div>

        {/* Date Selector with Next / Prev */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => shiftDate(1)} // In RTL, right arrow moves to tomorrow
            aria-label="اليوم التالي"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="relative flex-1 md:w-52">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <button
            onClick={() => shiftDate(-1)} // In RTL, left arrow moves to yesterday
            aria-label="اليوم السابق"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setSelectedDate(formatLocalDate(new Date()))}
            className="px-3 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            اليوم
          </button>
        </div>
      </div>

      {/* Date Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg md:text-xl font-bold flex items-center gap-2">
              <span>{formatDateArabic(selectedDate)}</span>
              {dayOfWeek === 5 && (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-medium">
                  يوم عطلة أسبوعية (الجمعة)
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {baseScheduledForDay.length} حصص أساسية مجدولة • {supportScheduledForDay.length} حصص دعم مجدولة
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveAllForToday}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>حفظ تسجيل اليوم</span>
        </button>
      </div>

      {/* SECTION 1: Base Sessions Scheduled for this Day */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>الحصص الأساسية المجدولة لهذا اليوم ({DAY_NAMES_ARABIC[dayOfWeek]})</span>
          </h2>
          <span className="text-xs text-slate-500">
            الحجم المبرمج:{' '}
            <span className="font-bold text-slate-800">
              {baseScheduledForDay.reduce((s, i) => s + i.durationMinutes, 0)} دقيقة
            </span>
          </span>
        </div>

        {baseScheduledForDay.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
            لا توجد حصص أساسية مبرمجة في جدول يوم {DAY_NAMES_ARABIC[dayOfWeek]}.
            {dayOfWeek === 5 ? ' (الجمعة عطلة أسبوعية)' : ''}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {baseScheduledForDay.map((baseItem) => {
              const draft = baseDrafts[baseItem.id] || {
                status: 'present',
                delayMinutes: 0,
                actualDurationMinutes: baseItem.durationMinutes,
                notes: '',
              };

              return (
                <div
                  key={baseItem.id}
                  className={`bg-white p-5 rounded-2xl border transition-all shadow-xs ${
                    draft.status === 'present'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : draft.status === 'absent'
                      ? 'border-rose-200 bg-rose-50/20'
                      : draft.status === 'late'
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Session Info */}
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold shrink-0 text-center">
                        <div className="font-mono">{baseItem.startTime}</div>
                        <div className="text-2xs text-slate-400 font-normal">إلى</div>
                        <div className="font-mono">{baseItem.endTime}</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900 text-base">
                          {baseItem.subject || 'حصة تدريس'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          {baseItem.gradeClass && (
                            <span className="flex items-center gap-1 font-medium">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {baseItem.gradeClass}
                            </span>
                          )}
                          <span>•</span>
                          <span className="font-bold text-indigo-700">
                            المدة: {baseItem.durationMinutes} دقيقة
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Radio Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Present */}
                      <button
                        type="button"
                        onClick={() =>
                          setBaseDrafts((prev) => ({
                            ...prev,
                            [baseItem.id]: {
                              ...draft,
                              status: 'present',
                              delayMinutes: 0,
                              actualDurationMinutes: baseItem.durationMinutes,
                            },
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          draft.status === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>حاضر ({baseItem.durationMinutes} د)</span>
                      </button>

                      {/* Absent */}
                      <button
                        type="button"
                        onClick={() =>
                          setBaseDrafts((prev) => ({
                            ...prev,
                            [baseItem.id]: {
                              ...draft,
                              status: 'absent',
                              delayMinutes: 0,
                              actualDurationMinutes: 0,
                            },
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          draft.status === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>غائب</span>
                      </button>

                      {/* Late */}
                      <button
                        type="button"
                        onClick={() =>
                          setBaseDrafts((prev) => ({
                            ...prev,
                            [baseItem.id]: {
                              ...draft,
                              status: 'late',
                              delayMinutes: draft.delayMinutes || 10,
                            },
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          draft.status === 'late'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>متأخر</span>
                      </button>

                      {/* Cancelled by School */}
                      <button
                        type="button"
                        onClick={() =>
                          setBaseDrafts((prev) => ({
                            ...prev,
                            [baseItem.id]: {
                              ...draft,
                              status: 'cancelled_by_school',
                              delayMinutes: 0,
                            },
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          draft.status === 'cancelled_by_school'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>ملغاة من المدرسة</span>
                      </button>
                    </div>
                  </div>

                  {/* Contextual Delay & Notes row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {draft.status === 'late' ? (
                      <div className="flex items-center gap-2">
                        <label className="font-bold text-amber-900 whitespace-nowrap">
                          مدة التأخر (بالدقائق):
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={baseItem.durationMinutes}
                          value={draft.delayMinutes}
                          onChange={(e) =>
                            setBaseDrafts((prev) => ({
                              ...prev,
                              [baseItem.id]: {
                                ...draft,
                                delayMinutes: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-24 bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono font-bold text-amber-900 focus:outline-hidden"
                        />
                        <span className="text-slate-500 font-medium">
                          (المنجز: {Math.max(0, baseItem.durationMinutes - draft.delayMinutes)} د)
                        </span>
                      </div>
                    ) : draft.status === 'absent' ? (
                      <div className="text-rose-700 font-medium flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span>يُسجل غياب كامل لمدة {baseItem.durationMinutes} دقيقة.</span>
                      </div>
                    ) : draft.status === 'cancelled_by_school' ? (
                      <div className="text-slate-600 font-medium flex items-center gap-1.5">
                        <Ban className="w-4 h-4 text-slate-400" />
                        <span>ملغاة بقرار المدرسة — لا تخصم من حقوق الأستاذ.</span>
                      </div>
                    ) : (
                      <div className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>تم إنجاز الحصة كاملة ({baseItem.durationMinutes} دقيقة).</span>
                      </div>
                    )}

                    <div>
                      <input
                        type="text"
                        placeholder="ملاحظة حول الحصة (اختياري)..."
                        value={draft.notes}
                        onChange={(e) =>
                          setBaseDrafts((prev) => ({
                            ...prev,
                            [baseItem.id]: {
                              ...draft,
                              notes: e.target.value,
                            },
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Recurring Support Sessions on this Day */}
      {supportScheduledForDay.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>حصص الدعم المجدولة لهذا اليوم ({DAY_NAMES_ARABIC[dayOfWeek]})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportScheduledForDay.map((suppItem) => {
              const draft = supportDrafts[suppItem.id] || {
                completed: false,
                durationMinutes: 60,
                notes: '',
              };

              return (
                <div
                  key={suppItem.id}
                  className={`bg-white p-5 rounded-2xl border transition-all shadow-xs ${
                    draft.completed ? 'border-indigo-300 bg-indigo-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {suppItem.subject || 'حصة دعم'}
                      </div>
                      {suppItem.groupName && (
                        <div className="text-xs text-slate-500 mt-0.5">{suppItem.groupName}</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSupportDrafts((prev) => ({
                          ...prev,
                          [suppItem.id]: {
                            ...draft,
                            completed: !draft.completed,
                          },
                        }))
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        draft.completed
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {draft.completed ? 'أُنجزت اليوم ✓' : 'لم تُنجز'}
                    </button>
                  </div>

                  {draft.completed && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <label className="font-bold text-slate-700">المدة الفعلية المنجزة:</label>
                        <input
                          type="number"
                          min="1"
                          max="480"
                          value={draft.durationMinutes}
                          onChange={(e) =>
                            setSupportDrafts((prev) => ({
                              ...prev,
                              [suppItem.id]: {
                                ...draft,
                                durationMinutes: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-indigo-700 text-xs focus:outline-hidden"
                        />
                        <span className="text-slate-500">دقيقة</span>
                      </div>

                      <input
                        type="text"
                        placeholder="ملاحظات حول حصة الدعم..."
                        value={draft.notes}
                        onChange={(e) =>
                          setSupportDrafts((prev) => ({
                            ...prev,
                            [suppItem.id]: {
                              ...draft,
                              notes: e.target.value,
                            },
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Exceptional & Extra Sessions for this Date */}
      <div className="pt-4 border-t border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>الحصص الإضافية والاستثنائية المسجلة لهذا التاريخ</span>
          </h2>

          <button
            onClick={() => setIsExceptionalModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حصة استثنائية لهذا اليوم</span>
          </button>
        </div>

        {datedExtraSessions.length === 0 ? (
          <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 text-xs">
            لا توجد حصص استثنائية أو إضافية مسجلة لهذا التاريخ.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {datedExtraSessions.map((extra) => (
              <div
                key={extra.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{extra.subject}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    المدة المنجزة: <span className="font-bold text-indigo-700">{extra.actualDurationMinutes} دقيقة</span>
                    {extra.notes ? ` • ${extra.notes}` : ''}
                  </div>
                </div>
                <span className="text-2xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                  إضافية
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exceptional Session Modal */}
      {isExceptionalModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <form onSubmit={handleAddExceptionalSession}>
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">
                  إضافة حصة استثنائية لتاريخ: {formatDateArabic(selectedDate)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تسجيل حصة غير مبرمجة في الجدول العادي أو يوم عطلة
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المادة / الموضوع
                  </label>
                  <input
                    type="text"
                    value={exceptionalSubject}
                    onChange={(e) => setExceptionalSubject(e.target.value)}
                    required
                    placeholder="مثال: تعويض حصة سابقة"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المدة المنجزة بالدقائق
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={exceptionalDuration}
                    onChange={(e) => setExceptionalDuration(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات (اختياري)
                  </label>
                  <input
                    type="text"
                    value={exceptionalNotes}
                    onChange={(e) => setExceptionalNotes(e.target.value)}
                    placeholder="مثال: بطلب من إدارة المؤسسة"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExceptionalModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  إضافة الحصة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
