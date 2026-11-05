/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  resolveWeekCalendar,
  CalendarSessionItem,
  CalendarSessionStatus,
} from '../utils/calendarEngine.ts';
import {
  formatLocalDate,
  getSaturdayOfWeek,
  parseLocalDate,
  formatDateArabic,
  DAY_NAMES_ARABIC,
} from '../utils/dateUtils.ts';
import { DailySessionRecord, AttendanceStatus } from '../types/index.ts';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  Info,
  Edit3,
  X,
  Save,
  Trash2,
  Filter,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const WeeklyCalendarView: React.FC = () => {
  const { db, saveDailyRecord, deleteDailyRecord, showToast } = useApp();

  // Current date
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Currently viewed week starting Saturday
  const [selectedSaturday, setSelectedSaturday] = useState<string>(() =>
    getSaturdayOfWeek(todayStr)
  );

  // Jump-to date picker input
  const [jumpDateInput, setJumpDateInput] = useState<string>(todayStr);

  // Modal state for session logging
  const [activeSession, setActiveSession] = useState<CalendarSessionItem | null>(null);

  // Form state inside modal
  const [modalStatus, setModalStatus] = useState<AttendanceStatus>('present');
  const [modalDelayMinutes, setModalDelayMinutes] = useState<number>(10);
  const [modalDurationMinutes, setModalDurationMinutes] = useState<number>(55);
  const [modalNotes, setModalNotes] = useState<string>('');

  // Status filter for calendar view
  const [statusFilter, setStatusFilter] = useState<'all' | 'unrecorded' | 'completed' | 'absent' | 'late'>('all');

  // Compute week summary and resolved sessions
  const weekSummary = useMemo(() => {
    return resolveWeekCalendar(
      selectedSaturday,
      db.baseSchedule || [],
      db.supportSchedule || [],
      db.dailyRecords || [],
      new Date()
    );
  }, [selectedSaturday, db.baseSchedule, db.supportSchedule, db.dailyRecords]);

  // Find if this week record is approved, in progress, or unreviewed
  const currentWeekRecord = useMemo(() => {
    return (db.weeks || []).find((w) => w.startDate === selectedSaturday);
  }, [db.weeks, selectedSaturday]);

  // Navigation handlers
  const handlePrevWeek = () => {
    const cur = parseLocalDate(selectedSaturday);
    cur.setDate(cur.getDate() - 7);
    setSelectedSaturday(formatLocalDate(cur));
  };

  const handleNextWeek = () => {
    const cur = parseLocalDate(selectedSaturday);
    cur.setDate(cur.getDate() + 7);
    setSelectedSaturday(formatLocalDate(cur));
  };

  const handleCurrentWeek = () => {
    setSelectedSaturday(getSaturdayOfWeek(todayStr));
  };

  const handleJumpToDate = (dateVal: string) => {
    if (!dateVal) return;
    setJumpDateInput(dateVal);
    setSelectedSaturday(getSaturdayOfWeek(dateVal));
  };

  // Open modal for a session
  const handleOpenSessionModal = (session: CalendarSessionItem) => {
    setActiveSession(session);
    if (session.record) {
      // Existing record
      setModalStatus(session.record.status);
      setModalDelayMinutes(session.record.delayMinutes || 0);
      setModalDurationMinutes(session.record.actualDurationMinutes || session.durationMinutes);
      setModalNotes(session.record.notes || '');
    } else {
      // New record for this scheduled session: default to present
      setModalStatus('present');
      setModalDelayMinutes(0);
      setModalDurationMinutes(session.durationMinutes);
      setModalNotes(session.notes || '');
    }
  };

  // Save session attendance
  const handleSaveSessionAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    let actualDuration = modalDurationMinutes;
    if (modalStatus === 'present') {
      actualDuration = modalDurationMinutes;
    } else if (modalStatus === 'late') {
      actualDuration = Math.max(0, modalDurationMinutes - modalDelayMinutes);
    } else if (modalStatus === 'absent' || modalStatus === 'cancelled_by_school') {
      actualDuration = 0;
    }

    const payload: Omit<DailySessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: activeSession.record?.id,
      date: activeSession.date,
      type: activeSession.sourceType === 'base' ? 'base' : activeSession.sourceType === 'support' ? 'recurring_support' : 'dated_extra',
      baseScheduleId: activeSession.sourceType === 'base' ? activeSession.scheduleItemId : undefined,
      supportScheduleId: activeSession.sourceType === 'support' ? activeSession.scheduleItemId : undefined,
      subject: activeSession.subject,
      groupName: activeSession.groupName,
      scheduledStartTime: activeSession.startTime,
      scheduledEndTime: activeSession.endTime,
      scheduledDurationMinutes: activeSession.durationMinutes,
      actualStartTime: activeSession.startTime,
      actualEndTime: activeSession.endTime,
      actualDurationMinutes: actualDuration,
      status: modalStatus,
      delayMinutes: modalStatus === 'late' ? modalDelayMinutes : 0,
      notes: modalNotes.trim() || undefined,
    };

    saveDailyRecord(payload);
    showToast('success', `تم تسجيل حالة الحصة بنجاح (${activeSession.subject} - ${activeSession.dayNameArabic})`);
    setActiveSession(null);
  };

  // Revert/delete record back to unrecorded
  const handleDeleteRecord = () => {
    if (activeSession && activeSession.record) {
      deleteDailyRecord(activeSession.record.id);
      showToast('info', 'تم إلغاء تسجيل الحصة وإعادتها لحالتها السابقة.');
      setActiveSession(null);
    }
  };

  // Visual helper for session cards based on status
  const getCardStyle = (status: CalendarSessionStatus) => {
    switch (status) {
      case 'completed':
        return {
          cardBg: 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotColor: 'bg-emerald-500',
          icon: CheckCircle2,
          textColor: 'text-emerald-950',
        };
      case 'unrecorded_past':
        return {
          cardBg: 'bg-rose-50/80 border-rose-300 hover:border-rose-500 hover:bg-rose-50 ring-1 ring-rose-400/40',
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse',
          dotColor: 'bg-rose-500',
          icon: AlertCircle,
          textColor: 'text-rose-950',
        };
      case 'upcoming_future':
        return {
          cardBg: 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white',
          badgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
          dotColor: 'bg-slate-400',
          icon: Clock,
          textColor: 'text-slate-800',
        };
      case 'late':
        return {
          cardBg: 'bg-amber-50/80 border-amber-300 hover:border-amber-500 hover:bg-amber-50',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
          dotColor: 'bg-amber-500',
          icon: AlertTriangle,
          textColor: 'text-amber-950',
        };
      case 'absent':
        return {
          cardBg: 'bg-purple-50/80 border-purple-300 hover:border-purple-500 hover:bg-purple-50',
          badgeBg: 'bg-purple-100 text-purple-900 border-purple-200',
          dotColor: 'bg-purple-500',
          icon: Ban,
          textColor: 'text-purple-950',
        };
      case 'cancelled':
        return {
          cardBg: 'bg-sky-50/70 border-sky-300 hover:border-sky-500 hover:bg-sky-50',
          badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
          dotColor: 'bg-sky-500',
          icon: Ban,
          textColor: 'text-sky-950',
        };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>الرزنامة الأسبوعية الذكية</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <CalendarIcon className="w-3 h-3 text-slate-500" />
              <span>بداية الأسبوع: السبت</span>
            </span>
            {currentWeekRecord && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  currentWeekRecord.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : currentWeekRecord.status === 'in_progress'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentWeekRecord.status === 'approved'
                      ? 'bg-emerald-500'
                      : currentWeekRecord.status === 'in_progress'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span>
                  {currentWeekRecord.status === 'approved'
                    ? 'أسبوع معتمد ومُقيّم'
                    : currentWeekRecord.status === 'in_progress'
                    ? 'أسبوع قيد المراجعة'
                    : 'أسبوع غير مُقيّم'}
                </span>
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>مراقبة الحصص المبرمجة والمنجزة أسبوعيًا</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            استعراض تلقائي لكافة الحصص المبرمجة المستخرجة من جدولك الثابت لكل أسبوع، مع كشف الحصص المنتهية التي نُسي تسجيلها لضمان عدم ضياع أي ساعة.
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Quick Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">انتقال:</span>
            <input
              type="date"
              value={jumpDateInput}
              onChange={(e) => handleJumpToDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Prev / Current / Next Buttons */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 shadow-2xs">
            <button
              onClick={handleNextWeek}
              title="الأسبوع اللاحق (+7 أيام)"
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>التالي</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCurrentWeek}
              title="العودة للأسبوع الحالي"
              className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              الأسبوع الحالي
            </button>
            <button
              onClick={handlePrevWeek}
              title="الأسبوع السابق (-7 أيام)"
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>السابق</span>
            </button>
          </div>
        </div>
      </div>

      {/* Week Date Span Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-xs text-indigo-200 font-semibold">الأسبوع المعروض في الرزنامة:</div>
            <div className="text-sm sm:text-base font-black tracking-tight text-white mt-0.5">
              من {formatDateArabic(weekSummary.saturdayDate, true)} — إلى {formatDateArabic(weekSummary.thursdayDate, true)}
              <span className="text-xs text-indigo-300 font-normal mr-2">(وتشمل الجمعة {formatDateArabic(weekSummary.fridayDate, false)})</span>
            </div>
          </div>
        </div>

        {/* Filter Sessions Button Strip */}
        <div className="flex items-center gap-1.5 text-xs bg-white/10 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-200 hover:text-white'
            }`}
          >
            الكل ({weekSummary.totalProgrammed})
          </button>
          <button
            onClick={() => setStatusFilter('unrecorded')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'unrecorded' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-200 hover:text-white'
            }`}
          >
            غير المسجلة ({weekSummary.unrecordedPastCount})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'completed' ? 'bg-emerald-500 text-white shadow-xs' : 'text-emerald-200 hover:text-white'
            }`}
          >
            المنجزة ({weekSummary.recordedCount})
          </button>
        </div>
      </div>

      {/* Urgent Warning Banner for Past Unrecorded Sessions */}
      {weekSummary.unrecordedPastCount > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl shadow-sm flex items-start sm:items-center justify-between gap-3 text-rose-950 animate-fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-rose-900">
                تنبيه: لديك {weekSummary.unrecordedPastCount} حصص انتهى موعدها ولم يتم تسجيلها هذا الأسبوع!
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                تظهر هذه الحصص باللون <strong className="underline">الأحمر</strong> أدناه. انقر على أي حصة لتسجيل إنجازها، تأخرها، غيابها، أو إلغائها لتحديث الرصيد بدقة.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('unrecorded')}
            className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer whitespace-nowrap"
          >
            عرض غير المسجلة فقط
          </button>
        </div>
      )}

      {/* Color Legend Key (دليل ودلالات الألوان) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="text-xs font-bold text-slate-500 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>مفتاح دلالات ألوان وحالات الرزنامة الأسبوعية:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-semibold">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <div className="font-bold">أخضر: منجزة</div>
              <div className="text-[10px] text-emerald-700">حضر الأستاذ وأنجزها</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-900">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 animate-ping" />
            <div>
              <div className="font-bold">أحمر: لم تُسجل</div>
              <div className="text-[10px] text-rose-700">انتهت وتحتاج مراجعة</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
            <div>
              <div className="font-bold">رمادي: مستقبلية</div>
              <div className="text-[10px] text-slate-500">لم يحن موعدها بعد</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <div>
              <div className="font-bold">برتقالي: متأخر</div>
              <div className="text-[10px] text-amber-700">مسجلة مع عدد الدقائق</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
            <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
            <div>
              <div className="font-bold">بنفسجي: غياب</div>
              <div className="text-[10px] text-purple-700">غياب مسجل صراحة</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
            <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
            <div>
              <div className="font-bold">أزرق: ملغاة</div>
              <div className="text-[10px] text-sky-700">بقرار من المؤسسة</div>
            </div>
          </div>
        </div>
      </div>

      {/* Week Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-2xs font-extrabold text-slate-400">الحصص المبرمجة</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{weekSummary.totalProgrammed}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">وفق الجدول الثابت</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-2xs font-extrabold text-emerald-600">الحصص المسجلة</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{weekSummary.recordedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">تم تأكيد حالتها</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-2xs font-extrabold text-rose-600">انتهت ولم تُسجل بعد</div>
          <div className={`text-2xl font-black mt-1 ${weekSummary.unrecordedPastCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {weekSummary.unrecordedPastCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">تحتاج مراجعة الأستاذ</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-2xs font-extrabold text-slate-400">الحصص المستقبلية</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{weekSummary.upcomingCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">في انتظار موعدها</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold text-indigo-600">نسبة تسجيل الأسبوع</span>
            <span className="text-xs font-black text-indigo-700">{weekSummary.recordingPercentage}%</span>
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {weekSummary.recordingPercentage}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                weekSummary.recordingPercentage === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${weekSummary.recordingPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 7-Days Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3.5 items-start">
        {weekSummary.days.map((day) => {
          // Filter day sessions if statusFilter is active
          const filteredDaySessions = day.sessions.filter((s) => {
            if (statusFilter === 'unrecorded') return s.calendarStatus === 'unrecorded_past';
            if (statusFilter === 'completed') return s.calendarStatus === 'completed';
            if (statusFilter === 'absent') return s.calendarStatus === 'absent';
            if (statusFilter === 'late') return s.calendarStatus === 'late';
            return true;
          });

          return (
            <div
              key={day.date}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col ${
                day.isToday
                  ? 'bg-indigo-50/30 border-indigo-300 ring-2 ring-indigo-400/30 shadow-md'
                  : 'bg-white border-slate-200/90 shadow-2xs'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3 border-b text-center ${
                  day.isToday
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white'
                    : 'bg-slate-50 text-slate-800 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${day.isToday ? 'text-white' : 'text-slate-900'}`}>
                    {day.dayNameArabic}
                  </span>
                  {day.isToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white">
                      اليوم
                    </span>
                  )}
                </div>
                <div className={`text-[11px] font-mono mt-0.5 ${day.isToday ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {day.date}
                </div>
                <div className={`text-[10px] mt-1 font-bold ${day.isToday ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {day.sessions.length} {day.sessions.length === 1 ? 'حصة مبرمجة' : day.sessions.length === 2 ? 'حصتان' : 'حصص'}
                </div>
              </div>

              {/* Day Sessions List */}
              <div className="p-2 space-y-2.5 min-h-[140px] flex-1 flex flex-col justify-start">
                {filteredDaySessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400 text-xs">
                    <span className="text-slate-300 mb-1 font-mono">—</span>
                    <span>{statusFilter === 'all' ? 'لا توجد حصص مبرمجة' : 'لا توجد حصص تطابق التصفية'}</span>
                  </div>
                ) : (
                  filteredDaySessions.map((session) => {
                    const style = getCardStyle(session.calendarStatus);
                    const Icon = style.icon;

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => handleOpenSessionModal(session)}
                        className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer shadow-2xs group relative ${style.cardBg}`}
                      >
                        {/* Time & Type row */}
                        <div className="flex items-center justify-between text-2xs mb-1">
                          <span className="font-mono font-black text-slate-800 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{session.startTime} - {session.endTime}</span>
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                              session.sourceType === 'base'
                                ? 'bg-indigo-100 text-indigo-800'
                                : session.sourceType === 'support'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {session.sourceType === 'base'
                              ? 'أساسية'
                              : session.sourceType === 'support'
                              ? 'دعم'
                              : 'إضافية'}
                          </span>
                        </div>

                        {/* Subject Title */}
                        <div className={`font-black text-xs leading-tight mb-1 ${style.textColor}`}>
                          {session.subject}
                        </div>

                        {/* Class / Group */}
                        {session.groupName && (
                          <div className="text-[11px] text-slate-600 font-medium mb-1 truncate">
                            {session.groupName}
                          </div>
                        )}

                        {/* Status Badge */}
                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold border ${style.badgeBg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dotColor}`} />
                            <span>{session.statusLabelArabic}</span>
                          </span>
                          <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Session Attendance Registration */}
      {activeSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    {activeSession.record ? 'تعديل تسجيل الحصة' : 'تسجيل حالة الحصة المبرمجة'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeSession.dayNameArabic} {activeSession.date} • من {activeSession.startTime} إلى {activeSession.endTime} ({activeSession.durationMinutes} دقيقة)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSession(null)}
                aria-label="إغلاق"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Info Summary */}
            <div className="px-5 pt-4 pb-2">
              <div className="p-3 bg-slate-100/70 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-700">المادة / النشاط:</span>{' '}
                  <span className="font-black text-slate-900">{activeSession.subject}</span>
                  {activeSession.groupName && (
                    <span className="text-slate-500 mr-2 font-medium">({activeSession.groupName})</span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  {activeSession.sourceType === 'base' ? 'حصة أساسية' : 'حصة دعم'}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSessionAttendance} className="p-5 space-y-4">
              {/* Status Radio Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  اختر حالة الحضور والإنجاز <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Present */}
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      modalStatus === 'present'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalStatus"
                      checked={modalStatus === 'present'}
                      onChange={() => setModalStatus('present')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>حاضر ومنجز</span>
                      </div>
                      <div className="text-[11px] text-slate-500">تم إنجاز الحصة كاملة ({modalDurationMinutes} د)</div>
                    </div>
                  </label>

                  {/* Late */}
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      modalStatus === 'late'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalStatus"
                      checked={modalStatus === 'late'}
                      onChange={() => setModalStatus('late')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>متأخر</span>
                      </div>
                      <div className="text-[11px] text-slate-500">خصم دقائق التأخر فقط</div>
                    </div>
                  </label>

                  {/* Absent */}
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      modalStatus === 'absent'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-950 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalStatus"
                      checked={modalStatus === 'absent'}
                      onChange={() => setModalStatus('absent')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5 text-purple-600" />
                        <span>غائب</span>
                      </div>
                      <div className="text-[11px] text-slate-500">إضافة {activeSession.durationMinutes} د للعجز</div>
                    </div>
                  </label>

                  {/* Cancelled by School */}
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      modalStatus === 'cancelled_by_school'
                        ? 'border-sky-500 bg-sky-50/70 text-sky-950 ring-2 ring-sky-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalStatus"
                      checked={modalStatus === 'cancelled_by_school'}
                      onChange={() => setModalStatus('cancelled_by_school')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5 text-sky-600" />
                        <span>ملغاة بقرار المدرسة</span>
                      </div>
                      <div className="text-[11px] text-slate-500">لا تحتسب كغياب على الأستاذ</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Delay Minutes Input if Late */}
              {modalStatus === 'late' && (
                <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span>عدد دقائق التأخر الفعلية:</span>
                    <span className="font-mono text-sm text-amber-700">{modalDelayMinutes} دقيقة</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={modalDurationMinutes - 1}
                    value={modalDelayMinutes}
                    onChange={(e) => setModalDelayMinutes(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                  <div className="flex items-center justify-between text-[11px] text-amber-800">
                    <span>المدة المنجزة الصافية: <strong>{Math.max(0, modalDurationMinutes - modalDelayMinutes)} دقيقة</strong></span>
                    <span>تضاف {modalDelayMinutes} دقيقة للعجز الأسبوعي</span>
                  </div>
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات الحصة (اختياري)
                </label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="مثال: تعويض جزء من درس الهندسة، تأخر بسبب الازدحام..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Actions Button Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  {activeSession.record && (
                    <button
                      type="button"
                      onClick={handleDeleteRecord}
                      className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      title="حذف التسجيل وإعادة الحصة لحالة غير المسجلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إلغاء التسجيل</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSession(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ التسجيل فوراً</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
