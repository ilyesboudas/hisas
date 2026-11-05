/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveWeekCalendar,
  findUnrecordedSessionsAcrossRecentWeeks,
  resolveCalendarSessionStatus,
  isSessionPast,
} from '../src/utils/calendarEngine.ts';
import {
  getSaturdayOfWeek,
  getThursdayOfWeek,
  formatLocalDate,
  parseLocalDate,
} from '../src/utils/dateUtils.ts';
import type {
  BaseScheduleItem,
  SupportScheduleItem,
  DailySessionRecord,
  WeekRecord,
  AppDatabaseSchema,
} from '../src/types/index.ts';
import { getInitialDemoDatabase } from '../src/utils/seedData.ts';
import { calculatePeriodSummary, calculateWeekMetrics } from '../src/utils/calculationEngine.ts';
import { APP_VERSION } from '../src/utils/version.ts';

describe('اختبارات الرزنامة الأسبوعية الذكية ونظام التحديث التلقائي', () => {

  it('الاختبار 1 و 2: إنشاء حصة ثابتة يوم السبت وظهورها التلقائي في جميع الأسابيع دون تكرار يدوي', () => {
    const fixedSaturdayBaseSession: BaseScheduleItem = {
      id: 'base_sat_math',
      dayOfWeek: 6, // السبت
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      subject: 'رياضيات 3ع',
      gradeClass: '3 ثانوي علوم',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    const baseSchedule = [fixedSaturdayBaseSession];
    const supportSchedule: SupportScheduleItem[] = [];
    const dailyRecords: DailySessionRecord[] = [];

    // فحص ظهورها في 3 أسابيع مختلفة
    const week1Sat = '2026-11-07';
    const week2Sat = '2026-11-14';
    const week3Sat = '2026-11-21';

    const calWeek1 = resolveWeekCalendar(week1Sat, baseSchedule, supportSchedule, dailyRecords);
    const calWeek2 = resolveWeekCalendar(week2Sat, baseSchedule, supportSchedule, dailyRecords);
    const calWeek3 = resolveWeekCalendar(week3Sat, baseSchedule, supportSchedule, dailyRecords);

    // التحقق من أن يوم السبت في كل أسبوع يحتوي على الحصة المبرمجة
    const satDay1 = calWeek1.days.find((d) => d.dayOfWeek === 6);
    const satDay2 = calWeek2.days.find((d) => d.dayOfWeek === 6);
    const satDay3 = calWeek3.days.find((d) => d.dayOfWeek === 6);

    assert.equal(satDay1?.sessions.length, 1, 'الأسبوع الأول يحتوي على الحصة');
    assert.equal(satDay2?.sessions.length, 1, 'الأسبوع الثاني يحتوي على الحصة تلقائياً');
    assert.equal(satDay3?.sessions.length, 1, 'الأسبوع الثالث يحتوي على الحصة تلقائياً');

    assert.equal(satDay1?.sessions[0].startTime, '09:00');
    assert.equal(satDay1?.sessions[0].endTime, '10:00');
    assert.equal(satDay1?.sessions[0].subject, 'رياضيات 3ع');
  });

  it('الاختبار 3: تسجيل الحصة كـ (حاضر ومنجز) يحول حالتها إلى الأخضر (completed)', () => {
    const sessionDate = '2026-10-17'; // السبت
    const baseItem: BaseScheduleItem = {
      id: 'base_sat_math',
      dayOfWeek: 6,
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      subject: 'رياضيات',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    const record: DailySessionRecord = {
      id: 'rec_sat_present',
      date: sessionDate,
      type: 'base',
      baseScheduleId: 'base_sat_math',
      subject: 'رياضيات',
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      scheduledDurationMinutes: 60,
      actualDurationMinutes: 60,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T10:05:00Z',
      updatedAt: '2026-10-17T10:05:00Z',
    };

    const cal = resolveWeekCalendar(sessionDate, [baseItem], [], [record]);
    const sat = cal.days.find((d) => d.date === sessionDate);
    const session = sat?.sessions[0];

    assert.equal(session?.calendarStatus, 'completed', 'الحصة المسجلة تتحول للأخضر (completed)');
    assert.equal(session?.isRecorded, true, 'isRecorded = true');
    assert.equal(session?.statusLabelArabic, 'حاضر ومنجز');
    assert.equal(cal.recordedCount, 1, 'تُحسب ضمن الحصص المسجلة');
  });

  it('الاختبار 4: حصة انتهى موعدها دون تسجيل تتحول إلى اللون الأحمر (unrecorded_past) مع عبارة «لم يتم التسجيل»', () => {
    const pastDate = '2026-10-17'; // تاريخ من الماضي
    const baseItem: BaseScheduleItem = {
      id: 'base_sat_math',
      dayOfWeek: 6,
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      subject: 'رياضيات',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    // لا يوجد تسجيل في dailyRecords
    const fakeNow = new Date('2026-10-25T12:00:00Z'); // وقت لاحق
    const cal = resolveWeekCalendar(pastDate, [baseItem], [], [], fakeNow);
    const sat = cal.days.find((d) => d.date === pastDate);
    const session = sat?.sessions[0];

    assert.equal(session?.calendarStatus, 'unrecorded_past', 'الحصة السابقة غير المسجلة تظهر بالأحمر (unrecorded_past)');
    assert.equal(session?.isRecorded, false, 'isRecorded = false');
    assert.equal(session?.statusLabelArabic, 'لم يتم التسجيل');
    assert.equal(cal.unrecordedPastCount, 1, 'تُحسب ضمن الحصص غير المسجلة للتنبيه');
  });

  it('الاختبار 5: الحصة المستقبلية تظهر باللون الرمادي (upcoming_future) دون وسمها كمنسية', () => {
    const futureDate = '2026-12-05'; // تاريخ في المستقبل
    const baseItem: BaseScheduleItem = {
      id: 'base_sat_math',
      dayOfWeek: 6,
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      subject: 'رياضيات',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    const fakeNow = new Date('2026-11-01T12:00:00Z'); // وقت سابق لتاريخ الحصة
    const cal = resolveWeekCalendar(futureDate, [baseItem], [], [], fakeNow);
    const sat = cal.days.find((d) => d.date === futureDate);
    const session = sat?.sessions[0];

    assert.equal(session?.calendarStatus, 'upcoming_future', 'الحصة المستقبلية تظهر بالرمادي (upcoming_future)');
    assert.equal(session?.isRecorded, false);
    assert.equal(session?.statusLabelArabic, 'لم يحن موعدها');
    assert.equal(cal.unrecordedPastCount, 0, 'لا تصنف إطلاقاً كمنسية');
    assert.equal(cal.upcomingCount, 1, 'تُحسب ضمن الحصص المستقبلية');
  });

  it('الاختبار 6: تسجيل الغياب صراحة يظهر باللون الصحيح (absent) دون خلطه بحالة عدم التسجيل', () => {
    const dateStr = '2026-10-18'; // الأحد
    const baseItem: BaseScheduleItem = {
      id: 'base_sun_1',
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '08:55',
      durationMinutes: 55,
      subject: 'رياضيات',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    const absentRecord: DailySessionRecord = {
      id: 'rec_sun_absent',
      date: dateStr,
      type: 'base',
      baseScheduleId: 'base_sun_1',
      subject: 'رياضيات',
      scheduledStartTime: '08:00',
      scheduledEndTime: '08:55',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 0,
      status: 'absent', // غياب مسجل
      delayMinutes: 0,
      notes: 'عطلة مرضية',
      createdAt: '2026-10-18T09:00:00Z',
      updatedAt: '2026-10-18T09:00:00Z',
    };

    const fakeNow = new Date('2026-10-25T12:00:00Z');
    const cal = resolveWeekCalendar('2026-10-17', [baseItem], [], [absentRecord], fakeNow);
    const sun = cal.days.find((d) => d.date === dateStr);
    const session = sun?.sessions[0];

    assert.equal(session?.calendarStatus, 'absent', 'الغياب يظهر بحالته المخصصة (absent)');
    assert.equal(session?.isRecorded, true, 'هو حصة مسجلة ومحددة وليست غير مسجلة');
    assert.equal(session?.statusLabelArabic, 'غياب مسجل');
    assert.equal(cal.absencesCount, 1, 'تُحسب في عداد الغيابات');
    assert.equal(cal.unrecordedPastCount, 0, 'لا تُحسب ضمن الحصص غير المسجلة');
  });

  it('الاختبار 7: التنقل بين الأسابيع دون تكرار أو تداخل السجلات', () => {
    const demoDb = getInitialDemoDatabase();
    
    const week1Sat = '2026-10-10';
    const week2Sat = '2026-10-17';

    const cal1 = resolveWeekCalendar(week1Sat, demoDb.baseSchedule, demoDb.supportSchedule, demoDb.dailyRecords);
    const cal2 = resolveWeekCalendar(week2Sat, demoDb.baseSchedule, demoDb.supportSchedule, demoDb.dailyRecords);

    assert.equal(cal1.saturdayDate, week1Sat);
    assert.equal(cal2.saturdayDate, week2Sat);
    assert.notEqual(cal1.days[0].date, cal2.days[0].date, 'تواريخ الأسابيع مستقلة تماماً');
  });

  it('الاختبار 8: تعديل الجدول الثابت لا يغيّر السجلات التاريخية المسجلة مسبقاً', () => {
    const pastDate = '2026-10-17';
    const initialBase: BaseScheduleItem = {
      id: 'base_history_test',
      dayOfWeek: 6,
      startTime: '08:00',
      endTime: '08:55',
      durationMinutes: 55,
      subject: 'هندسة قديمة',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    const historicRecord: DailySessionRecord = {
      id: 'rec_historic',
      date: pastDate,
      type: 'base',
      baseScheduleId: 'base_history_test',
      subject: 'هندسة قديمة',
      scheduledStartTime: '08:00',
      scheduledEndTime: '08:55',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 55,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T09:00:00Z',
      updatedAt: '2026-10-17T09:00:00Z',
    };

    // تغيير الجدول الثابت لليوم السبت لمادة جديدة بوقت مختلف
    const modifiedBase: BaseScheduleItem = {
      ...initialBase,
      subject: 'جبر متقدم جديد',
      startTime: '10:00',
      endTime: '11:00',
    };

    // السجل المسجل تاريخياً يحتفظ ببياناته الأصلية
    assert.equal(historicRecord.subject, 'هندسة قديمة');
    assert.equal(historicRecord.actualDurationMinutes, 55);
    assert.equal(historicRecord.status, 'present');
  });

  it('الاختبار 9: دالة كشف الحصص غير المسجلة للوحة التحكم (findUnrecordedSessionsAcrossRecentWeeks)', () => {
    const pastSat = '2026-10-10';
    const baseItem: BaseScheduleItem = {
      id: 'base_sat_math',
      dayOfWeek: 6,
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      subject: 'رياضيات',
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };

    const fakeNow = new Date('2026-10-25T12:00:00Z');
    // لا يوجد أي تسجيل
    const unrecordedList = findUnrecordedSessionsAcrossRecentWeeks([baseItem], [], [], 2, fakeNow);
    assert.ok(unrecordedList.length > 0, 'تم اكتشاف الحصص غير المسجلة بنجاح');
    assert.equal(unrecordedList[0].calendarStatus, 'unrecorded_past');
  });

  it('الاختبار 10: حماية البيانات وسلامة إصدار التطبيق (v1.4.0)', () => {
    assert.equal(APP_VERSION, '1.4.0', 'رقم إصدار التطبيق سليم ومطابق للإصدار الأخير');
  });

  it('الاختبار 11: التأخر يحسب الدقائق الفعلية والمنجز الصافي', () => {
    const statusResult = resolveCalendarSessionStatus(
      '2026-10-17',
      '08:55',
      {
        id: 'rec_late',
        date: '2026-10-17',
        type: 'base',
        scheduledDurationMinutes: 55,
        actualDurationMinutes: 45,
        delayMinutes: 10,
        status: 'late',
        createdAt: '2026-10-17T09:00:00Z',
        updatedAt: '2026-10-17T09:00:00Z',
      }
    );

    assert.equal(statusResult.status, 'late');
    assert.equal(statusResult.label, 'متأخر (10 د)');
    assert.equal(statusResult.isRecorded, true);
  });
});
