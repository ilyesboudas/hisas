/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import type { TrainingAssignment, TrainingAssignmentType, TrainingAssignmentStatus } from '../types/index.ts';
import {
  calculateSeasonTrainingMetrics,
  formatMinutesToArabic,
  validateTrainingAssignmentInput,
  getAvailableAcademicYears,
  DEFAULT_TRAINING_TARGET_HOURS,
} from '../utils/trainingEngine.ts';
import {
  GraduationCap,
  Award,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  X,
  Sparkles,
  Calendar,
  AlertCircle,
  TrendingUp,
  FileText,
  ChevronDown,
  Info,
  Check,
} from 'lucide-react';

export const TrainingsAssignmentsView: React.FC = () => {
  const {
    db,
    addTrainingAssignment,
    updateTrainingAssignment,
    deleteTrainingAssignment,
    selectedAcademicYear,
    setSelectedAcademicYear,
    showToast,
  } = useApp();

  const activities = useMemo(() => db.trainingsAssignments || [], [db.trainingsAssignments]);
  const targetHours = db.settings?.trainingTargetHours || DEFAULT_TRAINING_TARGET_HOURS;

  // Available academic years
  const availableYears = useMemo(() => {
    return getAvailableAcademicYears(activities, db.settings?.academicYear || '2026-2027');
  }, [activities, db.settings?.academicYear]);

  // Current active season
  const currentSeason = selectedAcademicYear || availableYears[0] || '2026-2027';

  // Metrics for the current season
  const metrics = useMemo(() => {
    return calculateSeasonTrainingMetrics(activities, currentSeason, targetHours);
  }, [activities, currentSeason, targetHours]);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TrainingAssignmentType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TrainingAssignmentStatus>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<TrainingAssignment | null>(null);

  // New academic year prompt modal
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');

  // Delete confirmation modal
  const [activityToDelete, setActivityToDelete] = useState<TrainingAssignment | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    type: TrainingAssignmentType;
    title: string;
    date: string;
    hours: number;
    minutes: number;
    notes: string;
    status: TrainingAssignmentStatus;
    academicYear: string;
  }>({
    type: 'training',
    title: '',
    date: new Date().toISOString().split('T')[0],
    hours: 2,
    minutes: 0,
    notes: '',
    status: 'completed',
    academicYear: currentSeason,
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Open modal for adding
  const handleOpenAddModal = () => {
    setEditingActivity(null);
    setFormData({
      type: 'training',
      title: '',
      date: new Date().toISOString().split('T')[0],
      hours: 2,
      minutes: 0,
      notes: '',
      status: 'completed',
      academicYear: currentSeason,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (activity: TrainingAssignment) => {
    setEditingActivity(activity);
    const safeMinutes = activity.durationMinutes || 0;
    setFormData({
      type: activity.type,
      title: activity.title || '',
      date: activity.date,
      hours: Math.floor(safeMinutes / 60),
      minutes: safeMinutes % 60,
      notes: activity.notes || '',
      status: activity.status,
      academicYear: activity.academicYear || currentSeason,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle submit form
  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();

    const totalMinutes = Math.max(0, formData.hours * 60 + formData.minutes);

    const validation = validateTrainingAssignmentInput({
      type: formData.type,
      date: formData.date,
      durationMinutes: totalMinutes,
      status: formData.status,
      academicYear: formData.academicYear,
    });

    if (!validation.isValid) {
      setFormError(validation.error || 'يرجى مراجعة البيانات المدخلة.');
      return;
    }

    if (editingActivity) {
      updateTrainingAssignment({
        ...editingActivity,
        type: formData.type,
        title: formData.title.trim() || undefined,
        date: formData.date,
        durationMinutes: totalMinutes,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
        academicYear: formData.academicYear.trim(),
      });
    } else {
      addTrainingAssignment({
        type: formData.type,
        title: formData.title.trim() || undefined,
        date: formData.date,
        durationMinutes: totalMinutes,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
        academicYear: formData.academicYear.trim(),
      });
    }

    setIsModalOpen(false);
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (activityToDelete) {
      deleteTrainingAssignment(activityToDelete.id);
      setActivityToDelete(null);
    }
  };

  // Add new academic year
  const handleAddNewSeason = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newYearInput.trim();
    if (!trimmed) return;
    setSelectedAcademicYear(trimmed);
    setNewYearInput('');
    setIsAddYearModalOpen(false);
    showToast('success', `تم التبديل إلى الموسم الدراسي الجديد: ${trimmed}`);
  };

  // Filtered activities list
  const filteredActivities = useMemo(() => {
    return activities
      .filter((act) => act.academicYear === currentSeason)
      .filter((act) => {
        if (typeFilter !== 'all' && act.type !== typeFilter) return false;
        if (statusFilter !== 'all' && act.status !== statusFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesTitle = act.title?.toLowerCase().includes(q);
          const matchesNotes = act.notes?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesNotes) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activities, currentSeason, typeFilter, statusFilter, searchTerm]);

  // Formatted representations for stat cards
  const completedFormatted = formatMinutesToArabic(metrics.completedMinutes);
  const remainingFormatted = formatMinutesToArabic(metrics.remainingMinutes);
  const targetFormatted = formatMinutesToArabic(metrics.targetMinutes);
  const surplusFormatted = formatMinutesToArabic(metrics.surplusMinutes);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>متابعة موسمية مستقلة</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Sparkles className="w-3 h-3" />
              <span>الهدف: {targetHours} ساعة ({targetHours * 60} دقيقة)</span>
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>التكوينات والتكليفات الرسمية</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            مساحة مخصصة لتدوين ومتابعة التكوينات المنجزة والتكليفات الموكلة للأستاذ خلال الموسم الدراسي، مستقلة تماماً عن حساب أنصبة التدريس والتصفية المالية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Academic Season Selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 mr-1" />
            <span className="text-xs font-bold text-slate-600">الموسم:</span>
            <select
              value={currentSeason}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="bg-white text-xs font-extrabold text-indigo-700 px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsAddYearModalOpen(true)}
              title="إضافة موسم دراسي جديد"
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add Activity Button */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تكوين أو تكليف</span>
          </button>
        </div>
      </div>

      {/* Surplus Callout Banner (when exceeded 16h) */}
      {metrics.hasSurplus && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm md:text-base">
                تهانينا! تم استيفاء النصاب المطلوب ({targetHours} ساعة) بنجاح
              </h3>
              <p className="text-xs text-emerald-50 mt-0.5">
                الفائض الإضافي عن الهدف الموسمي: <strong className="text-white underline">{surplusFormatted.fullText} ({metrics.surplusMinutes} دقيقة)</strong>
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-black bg-white/20 text-white">
            100% مكتمل + فائض
          </span>
        </div>
      )}

      {/* Four Main Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Required Target */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">المدة المطلوبة للموسم</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900">
              {targetHours} <span className="text-sm font-semibold text-slate-500">ساعة</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>ما يعادل {targetFormatted.totalMinutes} دقيقة نظامية</span>
            </div>
          </div>
        </div>

        {/* Card 2: Completed Duration */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">المدة المنجزة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-emerald-600">
              {completedFormatted.compactText}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{completedFormatted.fullText}</span>
              <span className="font-mono font-bold text-slate-600">({metrics.completedMinutes} د)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Remaining Duration */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">المدة المتبقية</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              metrics.remainingMinutes === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className={`text-2xl font-black ${
              metrics.remainingMinutes === 0 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {metrics.remainingMinutes === 0 ? '0 دقيقة' : remainingFormatted.compactText}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>
                {metrics.remainingMinutes === 0 ? 'تم استيفاء الهدف' : remainingFormatted.fullText}
              </span>
              <span className="font-mono font-bold text-slate-600">({metrics.remainingMinutes} د)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Progress Percentage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">نسبة الإنجاز</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black text-indigo-600">
                {metrics.progressPercentage.toFixed(1)}%
              </div>
              <span className="text-xs font-medium text-slate-500">
                {metrics.isTargetMet ? 'مكتمل' : 'قيد التقدم'}
              </span>
            </div>
            {/* Visual progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  metrics.isTargetMet ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${metrics.cappedProgressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Counters Strip */}
      <div className="bg-slate-100/70 p-3.5 rounded-xl border border-slate-200/60 flex flex-wrap items-center justify-around gap-4 text-xs font-bold text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>أنشطة التكوين: <strong className="text-slate-900 font-extrabold">{metrics.trainingsCount}</strong> ({metrics.completedTrainingsCount} منجز)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span>التكليفات المسجلة: <strong className="text-slate-900 font-extrabold">{metrics.assignmentsCount}</strong> ({metrics.completedAssignmentsCount} منجز)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>أنشطة قيد الإنجاز: <strong className="text-slate-900 font-extrabold">{metrics.inProgressCount}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span>إجمالي السجلات: <strong className="text-slate-900 font-extrabold">{metrics.totalActivitiesCount}</strong></span>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالعنوان أو تفاصيل الملاحظة..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter by Type */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">النوع:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">الكل</option>
            <option value="training">تكوين فقط</option>
            <option value="assignment">تكليف فقط</option>
          </select>
        </div>

        {/* Filter by Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">الحالة:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">الكل</option>
            <option value="completed">منجز فقط</option>
            <option value="in_progress">قيد الإنجاز فقط</option>
          </select>
        </div>

        {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('all');
              setStatusFilter('all');
            }}
            className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
          >
            إلغاء التصفية
          </button>
        )}
      </div>

      {/* Activities Table View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>سجل أنشطة الموسم ({currentSeason})</span>
            <span className="text-xs font-normal text-slate-500">({filteredActivities.length} نشاط)</span>
          </h2>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-3">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">لا توجد أنشطة مسجلة في هذا الموسم</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              يمكنك بدء تسجيل التكوينات والتكليفات المنجزة للوصول إلى الهدف المطلوب ({targetHours} ساعة).
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة النشاط الأول</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-extrabold text-slate-600">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">عنوان النشاط</th>
                  <th className="py-3 px-4">المدة المنجزة</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">الملاحظات</th>
                  <th className="py-3 px-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredActivities.map((act) => {
                  const durationFormat = formatMinutesToArabic(act.durationMinutes || 0);
                  const isCompleted = act.status === 'completed';

                  return (
                    <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-800">
                        {act.date}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {act.type === 'training' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>تكوين</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Award className="w-3.5 h-3.5" />
                            <span>تكليف</span>
                          </span>
                        )}
                      </td>

                      {/* Title */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block max-w-xs truncate">
                          {act.title || '—'}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900">
                          {isCompleted ? durationFormat.compactText : '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isCompleted ? `${act.durationMinutes} دقيقة` : 'غير محددة بعد'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" />
                            <span>منجز</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>قيد الإنجاز</span>
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 max-w-md">
                        <span className="text-slate-600 line-clamp-2" title={act.notes || ''}>
                          {act.notes || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-left whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(act)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="تعديل النشاط"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActivityToDelete(act)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف النشاط"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add or Edit Activity */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingActivity ? 'تعديل نشاط تكوين أو تكليف' : 'إضافة تكوين أو تكليف جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveActivity} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Activity Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع النشاط <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'training' })}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                      formData.type === 'training'
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <GraduationCap className={`w-5 h-5 ${formData.type === 'training' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-xs">تكوين</div>
                      <div className="text-[11px] text-slate-500">ندوة، ملتقى، تدريب</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'assignment' })}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                      formData.type === 'assignment'
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Award className={`w-5 h-5 ${formData.type === 'assignment' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-xs">تكليف</div>
                      <div className="text-[11px] text-slate-500">لجنة، تنسيق، تصحيح</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Title (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان أو موضوع النشاط <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: ندوة تعليمية حول مناهج الجيل الثاني، رئاسة مركز تصحيح..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Academic Year and Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Academic Year */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الموسم الدراسي <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    placeholder="2026-2027"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاريخ الإنجاز <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  حالة النشاط <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    formData.status === 'completed'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                      : 'border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === 'completed'}
                      onChange={() => setFormData({ ...formData, status: 'completed' })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold">منجز (مكتمل)</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    formData.status === 'in_progress'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900'
                      : 'border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === 'in_progress'}
                      onChange={() => setFormData({ ...formData, status: 'in_progress' })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold">قيد الإنجاز (مستمر)</span>
                  </label>
                </div>
              </div>

              {/* Duration Inputs */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  المدة المنجزة {formData.status === 'completed' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(صفر إذا لم تحدد بعد)</span>}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">الساعات</label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">الدقائق</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={formData.minutes}
                      onChange={(e) => setFormData({ ...formData, minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Duration preview */}
                <div className="mt-2.5 text-xs text-indigo-700 font-bold flex items-center justify-between">
                  <span>المكافئ الزمني:</span>
                  <span>
                    {formatMinutesToArabic(formData.hours * 60 + formData.minutes).fullText} ({formData.hours * 60 + formData.minutes} دقيقة)
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الملاحظات والتفاصيل
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="تفاصيل النشاط، المكان، الجهة المنظمة، طبيعة التكليف، المخرجات..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
                >
                  حفظ النشاط
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Academic Season */}
      {isAddYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5">
            <h3 className="font-extrabold text-sm text-slate-900 mb-1">إضافة موسم دراسي جديد</h3>
            <p className="text-xs text-slate-500 mb-4">
              أدخل تسمية الموسم الجديد (مثال: 2027-2028). لن تتأثر سجلات المواسم السابقة.
            </p>
            <form onSubmit={handleAddNewSeason} className="space-y-4">
              <input
                type="text"
                autoFocus
                required
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                placeholder="2027-2028"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddYearModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                >
                  تأكيد الموسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {activityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900">تأكيد حذف النشاط</h3>
            <p className="text-xs text-slate-500 mt-1">
              هل أنت متأكد من حذف هذا النشاط ({activityToDelete.title || (activityToDelete.type === 'training' ? 'تكوين' : 'تكليف')})؟ سيتم تحديث مجموع الساعات المنجزة والمتبقية تلقائياً.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
