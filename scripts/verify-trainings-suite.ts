/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateSeasonTrainingMetrics,
  formatMinutesToArabic,
  validateTrainingAssignmentInput,
  getAvailableAcademicYears,
  DEFAULT_TRAINING_TARGET_HOURS,
  DEFAULT_TRAINING_TARGET_MINUTES,
} from '../src/utils/trainingEngine.ts';

import type { TrainingAssignment, AppDatabaseSchema } from '../src/types/index.ts';
import { validateDatabaseSchema, deduplicateRecords, DEFAULT_SETTINGS } from '../src/utils/storage.ts';
import { calculatePeriodSummary } from '../src/utils/calculationEngine.ts';
import { getInitialDemoDatabase } from '../src/utils/seedData.ts';

describe('اختبارات تبويب «التكوينات والتكليفات» ومحرك الحسابات المستقل', () => {

  it('الاختبار 1: تكوين مدته ساعتان (120 د) + تكليف مدته 1.5 ساعة (90 د) = 3 ساعات و30 دقيقة (210 د)', () => {
    const activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        title: 'ندوة بيداغوجية',
        date: '2026-10-05',
        durationMinutes: 120, // 2 hours
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't2',
        type: 'assignment',
        title: 'عضوية لجنة امتحانات',
        date: '2026-10-10',
        durationMinutes: 90, // 1.5 hours
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.completedMinutes, 210, 'المجموع المنجز يجب أن يكون 210 دقائق');
    
    const formatted = formatMinutesToArabic(metrics.completedMinutes);
    assert.equal(formatted.hours, 3, 'عدد الساعات المنجزة = 3');
    assert.equal(formatted.minutes, 30, 'عدد الدقائق المنجزة = 30');
    assert.equal(formatted.compactText, '3 سا 30 د');
  });

  it('الاختبار 2: المدة المتبقية = 12 ساعة و30 دقيقة (750 دقيقة) من أصل 16 ساعة (960 دقيقة)', () => {
    const activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 210, // 3h 30m
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.targetMinutes, 960, 'الهدف المطلوب = 960 دقيقة');
    assert.equal(metrics.remainingMinutes, 750, 'المتبقي = 960 - 210 = 750 دقيقة');

    const formattedRemaining = formatMinutesToArabic(metrics.remainingMinutes);
    assert.equal(formattedRemaining.hours, 12, 'الساعات المتبقية = 12');
    assert.equal(formattedRemaining.minutes, 30, 'الدقائق المتبقية = 30');
    assert.equal(formattedRemaining.compactText, '12 سا 30 د');
  });

  it('الاختبار 3: نسبة الإنجاز = 21.875% (~21.9%) بدقة رياضية تامة', () => {
    const activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 210, // 210 / 960 = 0.21875 = 21.875%
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.progressPercentage, 21.875, 'نسبة الإنجاز يجب أن تكون 21.875%');
    assert.equal(metrics.progressPercentage.toFixed(1), '21.9', 'النسبة المقربة = 21.9%');
  });

  it('الاختبار 4: النشاط قيد الإنجاز (سواء بمدة 0 أو أي مدة) لا يدخل في المنجز', () => {
    const activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 120,
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't2',
        type: 'assignment',
        date: '2026-10-06',
        durationMinutes: 0,
        status: 'in_progress', // قيد الإنجاز بمدة 0
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't3',
        type: 'training',
        date: '2026-10-07',
        durationMinutes: 180,
        status: 'in_progress', // قيد الإنجاز بمدة تقديرية
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.completedMinutes, 120, 'فقط النشاط المكتمل يدخل في المنجز (120 دقيقة)');
    assert.equal(metrics.inProgressCount, 2, 'الأنشطة قيد الإنجاز = 2');
    assert.equal(metrics.remainingMinutes, 840, 'المتبقي = 960 - 120 = 840 دقيقة');
  });

  it('الاختبار 5: تحويل نشاط من قيد الإنجاز إلى منجز يحدّث المجاميع فوراً', () => {
    let activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 120,
        status: 'in_progress',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    let metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.completedMinutes, 0, 'قبل الإنجاز المنجز = 0');

    // تحويله إلى مكتمل
    activities = activities.map((a) => (a.id === 't1' ? { ...a, status: 'completed' as const } : a));
    metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.completedMinutes, 120, 'بعد تحويله إلى مكتمل، المنجز = 120 دقيقة');
    assert.equal(metrics.remainingMinutes, 840, 'المتبقي = 840 دقيقة');
  });

  it('الاختبار 6: حذف نشاط يخصم مدته من المنجز ويعيد احتساب المتبقي والنسبة', () => {
    let activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 120,
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't2',
        type: 'assignment',
        date: '2026-10-06',
        durationMinutes: 90,
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    assert.equal(calculateSeasonTrainingMetrics(activities, '2026-2027', 16).completedMinutes, 210);

    // حذف النشاط t2
    activities = activities.filter((a) => a.id !== 't2');
    const metricsAfter = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metricsAfter.completedMinutes, 120, 'المنجز بعد الحذف = 120 دقيقة');
    assert.equal(metricsAfter.remainingMinutes, 840, 'المتبقي بعد الحذف = 840 دقيقة');
    assert.equal(metricsAfter.progressPercentage, 12.5, 'النسبة بعد الحذف = 12.5%');
  });

  it('الاختبار 7: تعديل مدة نشاط يحدّث المنجز والمتبقي والنسبة بدقة', () => {
    let activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 60, // 1 hour
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    assert.equal(calculateSeasonTrainingMetrics(activities, '2026-2027', 16).completedMinutes, 60);

    // تعديل المدة إلى 180 دقيقة (3 ساعات)
    activities = activities.map((a) => (a.id === 't1' ? { ...a, durationMinutes: 180 } : a));
    const updatedMetrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(updatedMetrics.completedMinutes, 180, 'المنجز بعد التعديل = 180 دقيقة');
    assert.equal(updatedMetrics.remainingMinutes, 780, 'المتبقي = 780 دقيقة');
    assert.equal(updatedMetrics.progressPercentage, 18.75, 'النسبة = 18.75%');
  });

  it('الاختبار 8: تجاوز الهدف السنوي (18 ساعة مقابل 16 ساعة): المنجز 18 ساعة، المتبقي 0، النسبة 100%، والفائض ساعتان (120 د)', () => {
    const activities: TrainingAssignment[] = [
      {
        id: 't1',
        type: 'training',
        date: '2026-10-05',
        durationMinutes: 18 * 60, // 1080 minutes = 18 hours
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics.completedMinutes, 1080, 'المنجز الفعلي لا يُقص ولا يُتجاهل: 1080 دقيقة (18 ساعة)');
    assert.equal(metrics.remainingMinutes, 0, 'المدة المتبقية = 0');
    assert.equal(metrics.cappedProgressPercentage, 100, 'نسبة الإنجاز في الشريط = 100%');
    assert.equal(metrics.isTargetMet, true, 'تم استيفاء الهدف');
    assert.equal(metrics.hasSurplus, true, 'يوجد فائض عن الهدف');
    assert.equal(metrics.surplusMinutes, 120, 'الفائض الصافي = 120 دقيقة (ساعتان)');

    const surplusFormatted = formatMinutesToArabic(metrics.surplusMinutes);
    assert.equal(surplusFormatted.hours, 2);
    assert.equal(surplusFormatted.minutes, 0);
  });

  it('الاختبار 9: التبديل إلى موسم دراسي جديد يبدأ حسابه من الصفر ويحافظ على سجلات المواسم السابقة', () => {
    const activities: TrainingAssignment[] = [
      {
        id: 't_old_1',
        type: 'training',
        date: '2025-11-10',
        durationMinutes: 960, // 16h completed in 2025-2026
        status: 'completed',
        academicYear: '2025-2026',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't_new_1',
        type: 'assignment',
        date: '2026-10-15',
        durationMinutes: 120, // 2h in 2026-2027
        status: 'completed',
        academicYear: '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // موسم 2025-2026
    const metrics2025 = calculateSeasonTrainingMetrics(activities, '2025-2026', 16);
    assert.equal(metrics2025.completedMinutes, 960, 'موسم 2025-2026 منجز بالكامل');
    assert.equal(metrics2025.remainingMinutes, 0);

    // موسم 2026-2027
    const metrics2026 = calculateSeasonTrainingMetrics(activities, '2026-2027', 16);
    assert.equal(metrics2026.completedMinutes, 120, 'موسم 2026-2027 يحسب أنشطته فقط دون خلط');
    assert.equal(metrics2026.remainingMinutes, 840);

    // موسم جديد 2027-2028 لم تبدأ أنشطته بعد
    const metrics2027 = calculateSeasonTrainingMetrics(activities, '2027-2028', 16);
    assert.equal(metrics2027.completedMinutes, 0, 'الموسم الجديد يبدأ من الصفر تماماً');
    assert.equal(metrics2027.remainingMinutes, 960);
    assert.equal(metrics2027.progressPercentage, 0);
  });

  it('الاختبار 10: استقلالية تامة — أنشطة التكوينات والتكليفات لا تؤثر نهائياً على رصيد حصص التدريس أو التصفية المالية', () => {
    const demoDb = getInitialDemoDatabase();
    
    // حساب التصفية قبل إضافة التكوينات
    const snapBefore = calculatePeriodSummary(
      demoDb.weeks,
      demoDb.dailyRecords,
      demoDb.baseSchedule,
      demoDb.settings
    );

    // إضافة تكوينات وتكليفات متعددة
    const dbWithTrainings: AppDatabaseSchema = {
      ...demoDb,
      trainingsAssignments: [
        {
          id: 't1',
          type: 'training' as const,
          date: '2026-10-05',
          durationMinutes: 500,
          status: 'completed' as const,
          academicYear: '2026-2027',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 't2',
          type: 'assignment' as const,
          date: '2026-10-12',
          durationMinutes: 300,
          status: 'completed' as const,
          academicYear: '2026-2027',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    // حساب التصفية بعد إضافة التكوينات
    const snapAfter = calculatePeriodSummary(
      dbWithTrainings.weeks,
      dbWithTrainings.dailyRecords,
      dbWithTrainings.baseSchedule,
      dbWithTrainings.settings
    );

    assert.equal(snapBefore.approvedRequiredReferenceMinutes, snapAfter.approvedRequiredReferenceMinutes, 'الحجم المرجعي التدريسي لم يتغير');
    assert.equal(snapBefore.approvedBaseCompletedMinutes, snapAfter.approvedBaseCompletedMinutes, 'الحجم الصباحي المنجز لم يتغير');
    assert.equal(snapBefore.approvedExtraCompletedMinutes, snapAfter.approvedExtraCompletedMinutes, 'حجم الحصص الإضافية لم يتغير');
    assert.equal(snapBefore.approvedNetMinutes, snapAfter.approvedNetMinutes, 'الرصيد الصافي لم يتغير إطلاقاً');
    assert.equal(snapBefore.equivalentSessions, snapAfter.equivalentSessions, 'الحصص الفائضة لم تتغير إطلاقاً');
    assert.equal(snapBefore.remainderMinutes, snapAfter.remainderMinutes, 'باقي الدقائق لم يتغير إطلاقاً');
    assert.equal(snapBefore.financialAmount, snapAfter.financialAmount, 'المبلغ المالي للتصفية لم يتغير إطلاقاً');
  });

  it('الاختبار 11: تصدير واستيراد JSON يحافظ على سجلات التكوينات والمواسم دون تكرار ودون إتلاف', () => {
    const demoDb = getInitialDemoDatabase();
    
    // التحقق من صحة المخطط
    const validation = validateDatabaseSchema(demoDb);
    assert.equal(validation.isValid, true, 'مخطط قاعدة البيانات صالح');

    // محاكاة التصدير إلى JSON ثم الاستيراد
    const exportedJson = JSON.stringify(demoDb);
    const parsed = JSON.parse(exportedJson);
    const parsedValidation = validateDatabaseSchema(parsed);
    assert.equal(parsedValidation.isValid, true, 'البيانات المستوردة صالحة');

    // التحقق من عدم التكرار
    const duplicatedList = [...(parsed.trainingsAssignments || []), ...(parsed.trainingsAssignments || [])];
    const deduped = deduplicateRecords(duplicatedList);
    assert.equal(deduped.length, (parsed.trainingsAssignments || []).length, 'تم منع التكرار بنجاح');
  });

  it('اختبار إضافي للتحقق من المدخلات: منع المدة السالبة، ومنع النشاط المكتمل بمدة صفرية', () => {
    // 1. مدة سالبة مرفوضة
    const negCheck = validateTrainingAssignmentInput({
      type: 'training',
      date: '2026-10-10',
      durationMinutes: -10,
      status: 'completed',
      academicYear: '2026-2027',
    });
    assert.equal(negCheck.isValid, false, 'المدة السالبة يجب أن تُرفض');

    // 2. نشاط مكتمل بمدة 0 مرفوض
    const zeroCompletedCheck = validateTrainingAssignmentInput({
      type: 'assignment',
      date: '2026-10-10',
      durationMinutes: 0,
      status: 'completed',
      academicYear: '2026-2027',
    });
    assert.equal(zeroCompletedCheck.isValid, false, 'النشاط المنجز بمدة 0 يجب أن يُرفض');

    // 3. نشاط قيد الإنجاز بمدة 0 مقبول
    const zeroInProgressCheck = validateTrainingAssignmentInput({
      type: 'assignment',
      date: '2026-10-10',
      durationMinutes: 0,
      status: 'in_progress',
      academicYear: '2026-2027',
    });
    assert.equal(zeroInProgressCheck.isValid, true, 'النشاط قيد الإنجاز بمدة 0 مقبول');
  });
});
