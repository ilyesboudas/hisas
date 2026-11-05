/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeekMetrics,
  calculatePeriodSummary,
  convertMinutesToSessions,
  calculateFinancialAmount,
} from './calculationEngine.ts';
import { calculateIntervalMinutes } from './dateUtils.ts';
import { validateDatabaseSchema, deduplicateRecords, DEFAULT_SETTINGS } from './storage.ts';
import type { WeekRecord, DailySessionRecord, BaseScheduleItem, AppDatabaseSchema } from '../types/index.ts';

// Scenario 1: Evaluated week with reference 16h and completed base 14h, no extra, no absences, no delays.
// Deficit must clearly equal -120 minutes (-2 hours).
test('Scenario 1: Evaluated week 16h ref vs 14h base -> base deficit is exactly -120 min', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
    approvalDate: '2026-10-23T10:00:00Z',
  };

  // Base sessions totaling 14 hours = 840 minutes
  const records: DailySessionRecord[] = [
    {
      id: 'rec_1',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 840,
      actualDurationMinutes: 840,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);

  assert.equal(result.isApproved, true);
  assert.equal(result.requiredReferenceMinutes, 960); // 16 * 60
  assert.equal(result.completedBaseMinutes, 840); // 14 * 60
  assert.equal(result.completedExtraMinutes, 0);
  assert.equal(result.netMinutes, -120); // 840 - 960 = -120
});

// Scenario 2: Un-evaluated week with attendance and extra sessions; MUST NOT enter approved balance.
test('Scenario 2: Un-evaluated week is excluded from approved net balance', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-24',
    startDate: '2026-10-24',
    endDate: '2026-10-29',
    status: 'unreviewed', // Not approved!
  };

  const records: DailySessionRecord[] = [
    {
      id: 'rec_base',
      date: '2026-10-24',
      type: 'base',
      scheduledDurationMinutes: 840,
      actualDurationMinutes: 840,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-24T08:00:00Z',
      updatedAt: '2026-10-24T08:00:00Z',
    },
    {
      id: 'rec_extra',
      date: '2026-10-25',
      type: 'irregular_extra',
      scheduledDurationMinutes: 120,
      actualDurationMinutes: 120,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-25T14:00:00Z',
      updatedAt: '2026-10-25T14:00:00Z',
    },
  ];

  const weekResult = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);
  assert.equal(weekResult.isApproved, false);
  assert.equal(weekResult.netMinutes, 0); // Approved net minutes is strictly 0

  const periodSummary = calculatePeriodSummary([week], records, [], DEFAULT_SETTINGS);
  assert.equal(periodSummary.evaluatedWeeksCount, 0);
  assert.equal(periodSummary.unevaluatedWeeksCount, 1);
  assert.equal(periodSummary.approvedNetMinutes, 0); // Excluded from approved liquidation
  assert.equal(periodSummary.unapprovedExtraMinutes, 120); // Present in provisional unapproved info
});

// Scenario 3: Absence for a 55 min base session -> Impact counted once, not duplicated
test('Scenario 3: 55 min absence counted once without duplicate penalty', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  // 13 sessions present (13 * 55 = 715 min) + 1 session absent (55 min) = total 14 sessions (770 min)
  const records: DailySessionRecord[] = [
    {
      id: 'rec_present',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 715,
      actualDurationMinutes: 715,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
    {
      id: 'rec_absent',
      date: '2026-10-18',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 0,
      status: 'absent',
      delayMinutes: 0,
      createdAt: '2026-10-18T08:00:00Z',
      updatedAt: '2026-10-18T08:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);
  assert.equal(result.completedBaseMinutes, 715);
  assert.equal(result.absencesCount, 1);
  assert.equal(result.absencesMinutes, 55);
  // Net minutes = 715 - 960 = -245 minutes (exactly 960 - 715, no double subtraction)
  assert.equal(result.netMinutes, -245);
});

// Scenario 4: Delays of 10 min and 15 min -> total delay = 25 minutes
test('Scenario 4: Delay of 10 min then 15 min totals 25 min delay', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  const records: DailySessionRecord[] = [
    {
      id: 'rec_late1',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 45,
      status: 'late',
      delayMinutes: 10,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
    {
      id: 'rec_late2',
      date: '2026-10-18',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 40,
      status: 'late',
      delayMinutes: 15,
      createdAt: '2026-10-18T08:00:00Z',
      updatedAt: '2026-10-18T08:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);
  assert.equal(result.delaysCount, 2);
  assert.equal(result.delaysMinutes, 25);
  assert.equal(result.completedBaseMinutes, 45 + 40); // 85 min
});

// Scenario 5: 55 extra minutes = exactly 1 session, 0 remainder
test('Scenario 5: 55 min equals 1 session and 0 min remainder', () => {
  const converted = convertMinutesToSessions(55, 55);
  assert.equal(converted.equivalentSessions, 1);
  assert.equal(converted.remainderMinutes, 0);
  assert.equal(converted.hours, 0);
  assert.equal(converted.minutes, 55);
});

// Scenario 6: 110 extra minutes = exactly 2 sessions, 0 remainder
test('Scenario 6: 110 min equals 2 sessions and 0 min remainder', () => {
  const converted = convertMinutesToSessions(110, 55);
  assert.equal(converted.equivalentSessions, 2);
  assert.equal(converted.remainderMinutes, 0);
  assert.equal(converted.hours, 1);
  assert.equal(converted.minutes, 50);
});

// Scenario 7: 80 extra minutes = 1 session and 25 minutes remainder
test('Scenario 7: 80 min equals 1 session and 25 min remainder', () => {
  const converted = convertMinutesToSessions(80, 55);
  assert.equal(converted.equivalentSessions, 1);
  assert.equal(converted.remainderMinutes, 25);
  assert.equal(converted.hours, 1);
  assert.equal(converted.minutes, 20);
});

// Scenario 8: Duplicate session prevention
test('Scenario 8: Deduplication prevents duplicate records with same ID', () => {
  const records = [
    { id: 'sess_1', name: 'Math' },
    { id: 'sess_1', name: 'Math Updated' },
    { id: 'sess_2', name: 'Physics' },
  ];
  const deduplicated = deduplicateRecords(records);
  assert.equal(deduplicated.length, 2);
  assert.equal(deduplicated.find((r) => r.id === 'sess_1')?.name, 'Math Updated');
});

// Scenario 9: Modifying session duration immediately updates balances
test('Scenario 9: Modifying session duration updates balance correctly', () => {
  const week: WeekRecord = {
    id: 'week_1',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  const record1: DailySessionRecord = {
    id: 'rec_var',
    date: '2026-10-17',
    type: 'irregular_extra',
    scheduledDurationMinutes: 60,
    actualDurationMinutes: 60,
    status: 'present',
    delayMinutes: 0,
    createdAt: '2026-10-17T08:00:00Z',
    updatedAt: '2026-10-17T08:00:00Z',
  };

  const initial = calculateWeekMetrics(week, [record1], [], DEFAULT_SETTINGS);
  assert.equal(initial.completedExtraMinutes, 60);

  // Update duration to 120
  const updatedRecord = { ...record1, actualDurationMinutes: 120 };
  const updated = calculateWeekMetrics(week, [updatedRecord], [], DEFAULT_SETTINGS);
  assert.equal(updated.completedExtraMinutes, 120);
  assert.equal(updated.netMinutes - initial.netMinutes, 60);
});

// Scenario 10: Corrupted JSON import is rejected safely
test('Scenario 10: Corrupted JSON is safely rejected', () => {
  const invalidJson1 = null;
  const invalidJson2 = { version: 'invalid' };
  const invalidJson3 = { version: 1, baseSchedule: 'not-an-array' };

  assert.equal(validateDatabaseSchema(invalidJson1).isValid, false);
  assert.equal(validateDatabaseSchema(invalidJson2).isValid, false);
  assert.equal(validateDatabaseSchema(invalidJson3).isValid, false);
});

// Scenario 11: Export data, import again -> exact match
test('Scenario 11: Valid data passes validation cleanly', () => {
  const validDb: AppDatabaseSchema = {
    version: 1,
    exportedAt: '2026-10-17T10:00:00Z',
    appName: 'تدوين حصص التدريس',
    settings: DEFAULT_SETTINGS,
    baseSchedule: [],
    supportSchedule: [],
    dailyRecords: [
      {
        id: 'r1',
        date: '2026-10-17',
        type: 'base',
        scheduledDurationMinutes: 55,
        actualDurationMinutes: 55,
        status: 'present',
        delayMinutes: 0,
        createdAt: '2026-10-17T08:00:00Z',
        updatedAt: '2026-10-17T08:00:00Z',
      },
    ],
    weeks: [
      {
        id: 'w1',
        startDate: '2026-10-17',
        endDate: '2026-10-22',
        status: 'approved',
      },
    ],
    liquidations: [],
    auditLogs: [],
  };

  const validation = validateDatabaseSchema(validDb);
  assert.equal(validation.isValid, true);
});

// Scenario 12: Approving a week then reopening it recalculates balance
test('Scenario 12: Approving then reopening a week transitions approved net balance back to 0', () => {
  const week: WeekRecord = {
    id: 'week_1',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
    approvalDate: '2026-10-23T08:00:00Z',
  };

  const records: DailySessionRecord[] = [
    {
      id: 'rec_1',
      date: '2026-10-17',
      type: 'irregular_extra',
      scheduledDurationMinutes: 120,
      actualDurationMinutes: 120,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
  ];

  const approvedSummary = calculatePeriodSummary([week], records, [], DEFAULT_SETTINGS);
  assert.equal(approvedSummary.evaluatedWeeksCount, 1);

  // Re-open week
  const reopenedWeek: WeekRecord = {
    ...week,
    status: 'in_progress',
    reopenedDate: '2026-10-24T09:00:00Z',
    reopenReason: 'تصحيح غياب لم يُسجل',
  };

  const reopenedSummary = calculatePeriodSummary([reopenedWeek], records, [], DEFAULT_SETTINGS);
  assert.equal(reopenedSummary.evaluatedWeeksCount, 0);
  assert.equal(reopenedSummary.approvedNetMinutes, 0);
});

// Scenario 13: Midnight crossing validation and non-sensical duration rejection
test('Scenario 13: Midnight crossing works safely, non-sensical duration rejected', () => {
  // Normal session
  assert.equal(calculateIntervalMinutes('08:00', '08:55'), 55);
  // Crossing midnight (23:30 to 00:30 = 60 min)
  assert.equal(calculateIntervalMinutes('23:30', '00:30'), 60);
  // Same start and end -> 0 min
  assert.equal(calculateIntervalMinutes('08:00', '08:00'), 0);
  // Non-sensical duration (> 8 hours / 480 min)
  assert.equal(calculateIntervalMinutes('08:00', '19:00'), -1);
});

// Scenario 14: Financial liquidation per session price vs per hour rate
test('Scenario 14: Financial liquidation per session vs per hour', () => {
  // 110 net minutes
  // At 1500 per session (55 min): 110 / 55 * 1500 = 3000
  const perSession = calculateFinancialAmount(110, 'per_session', 1500);
  assert.equal(perSession.baseAmount, 3000);
  assert.equal(perSession.beneficiary, 'teacher');

  // At 1500 per hour (60 min): 110 / 60 * 1500 = 2750
  const perHour = calculateFinancialAmount(110, 'per_hour', 1500);
  assert.equal(perHour.baseAmount, 2750);
  assert.equal(perHour.beneficiary, 'teacher');

  // Negative balance (-55 min, deficit): school is beneficiary
  const deficit = calculateFinancialAmount(-55, 'per_session', 1000);
  assert.equal(deficit.baseAmount, -1000);
  assert.equal(deficit.beneficiary, 'school');
});

// Scenario 15: Save/deduplicate records does not duplicate items
test('Scenario 15: Repeated save does not create duplicate entries', () => {
  const item = { id: 'item_1', dayOfWeek: 6, startTime: '08:00' };
  const list = [item];
  const reSaved = deduplicateRecords([...list, { ...item }]);
  assert.equal(reSaved.length, 1);
});
