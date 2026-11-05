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
import type { WeekRecord, DailySessionRecord, BaseScheduleItem, AppDatabaseSchema, AppSettings } from '../types/index.ts';

// ==========================================
// MANDATORY TEST 1: 16 Required vs 14 Base -> Deficit = 110 minutes
// ==========================================
test('Mandatory Test 1: 16 required sessions vs 14 base sessions (55 min each) -> Base deficit is exactly 110 minutes', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
    approvalDate: '2026-10-23T10:00:00Z',
  };

  // 14 base sessions completed on time (14 * 55 = 770 min)
  const records: DailySessionRecord[] = [
    {
      id: 'rec_base_14',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 770,
      actualDurationMinutes: 770,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);

  assert.equal(result.isApproved, true);
  // Required: 16 * 55 = 880 min
  assert.equal(result.requiredReferenceMinutes, 880);
  // Completed base: 14 * 55 = 770 min
  assert.equal(result.completedBaseMinutes, 770);
  assert.equal(result.completedExtraMinutes, 0);
  // Base deficit: 770 - 880 = -110 minutes
  assert.equal(result.netMinutes, -110);

  const conversion = convertMinutesToSessions(result.netMinutes, 55, 60);
  assert.equal(conversion.isPositive, false);
  assert.equal(conversion.formattedSessionsText, 'عجز 110 دقيقة');
});

// ==========================================
// MANDATORY TEST 2: 1 Absence -> Adds 55 minutes to deficit
// ==========================================
test('Mandatory Test 2: One absence adds exactly 55 minutes to deficit (Total deficit = 165 min)', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  // 13 base sessions present (13 * 55 = 715 min) + 1 base session absent (55 min)
  const records: DailySessionRecord[] = [
    {
      id: 'rec_present_13',
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
      id: 'rec_absent_1',
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

  assert.equal(result.absencesCount, 1);
  assert.equal(result.absencesMinutes, 55);
  assert.equal(result.completedBaseMinutes, 715);
  // Deficit before extra: 715 - 880 = -165 min (110 base + 55 absence = 165 min deficit)
  assert.equal(result.netMinutes, -165);

  const conversion = convertMinutesToSessions(result.netMinutes, 55, 60);
  assert.equal(conversion.formattedSessionsText, 'عجز 165 دقيقة');
});

// ==========================================
// MANDATORY TEST 3: Delay of 10 min -> Adds 10 minutes to deficit
// ==========================================
test('Mandatory Test 3: Delay of 10 minutes adds exactly 10 minutes to deficit (Total deficit = 175 min)', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  // 12 sessions present (12 * 55 = 660 min)
  // 1 session absent (55 min)
  // 1 session late by 10 min (completed: 55 - 10 = 45 min)
  // Total completed base = 660 + 45 = 705 min
  const records: DailySessionRecord[] = [
    {
      id: 'rec_present_12',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 660,
      actualDurationMinutes: 660,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
    {
      id: 'rec_absent_1',
      date: '2026-10-18',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 0,
      status: 'absent',
      delayMinutes: 0,
      createdAt: '2026-10-18T08:00:00Z',
      updatedAt: '2026-10-18T08:00:00Z',
    },
    {
      id: 'rec_late_10min',
      date: '2026-10-19',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 45,
      status: 'late',
      delayMinutes: 10,
      createdAt: '2026-10-19T08:00:00Z',
      updatedAt: '2026-10-19T08:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);

  assert.equal(result.absencesCount, 1);
  assert.equal(result.absencesMinutes, 55);
  assert.equal(result.delaysCount, 1);
  assert.equal(result.delaysMinutes, 10);
  assert.equal(result.completedBaseMinutes, 705);
  // Total deficit: 705 - 880 = -175 min (110 base + 55 absence + 10 delay = 175 min)
  assert.equal(result.netMinutes, -175);

  const conversion = convertMinutesToSessions(result.netMinutes, 55, 60);
  assert.equal(conversion.formattedSessionsText, 'عجز 175 دقيقة');
});

// ==========================================
// MANDATORY TEST 4: Total deficit 175 min + 240 min extra sessions -> Surplus 65 min = 1 session (60 min) + 5 min remainder
// ==========================================
test('Mandatory Test 4: Deficit 175 min and 240 min extra sessions -> Surplus 65 min: 1 session (60 min) and 5 min remainder', () => {
  const week: WeekRecord = {
    id: 'week_2026-10-17',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  // 12 sessions present (660 min) + 1 absent (55 min) + 1 late by 10 min (45 min) = 705 min completed base
  // Deficit = 880 - 705 = 175 min
  // Extra sessions completed = 240 min (e.g. 2 sessions of 120 min)
  const records: DailySessionRecord[] = [
    {
      id: 'rec_base_present',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 660,
      actualDurationMinutes: 660,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
    {
      id: 'rec_base_absent',
      date: '2026-10-18',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 0,
      status: 'absent',
      delayMinutes: 0,
      createdAt: '2026-10-18T08:00:00Z',
      updatedAt: '2026-10-18T08:00:00Z',
    },
    {
      id: 'rec_base_late',
      date: '2026-10-19',
      type: 'base',
      scheduledDurationMinutes: 55,
      actualDurationMinutes: 45,
      status: 'late',
      delayMinutes: 10,
      createdAt: '2026-10-19T08:00:00Z',
      updatedAt: '2026-10-19T08:00:00Z',
    },
    {
      id: 'rec_extra_240',
      date: '2026-10-20',
      type: 'irregular_extra',
      scheduledDurationMinutes: 240,
      actualDurationMinutes: 240,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-20T14:00:00Z',
      updatedAt: '2026-10-20T14:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], DEFAULT_SETTINGS);

  assert.equal(result.completedBaseMinutes, 705);
  assert.equal(result.completedExtraMinutes, 240);
  // Net minutes: (705 + 240) - 880 = 945 - 880 = +65 minutes
  assert.equal(result.netMinutes, 65);

  // Convert on 60 min surplus evaluation basis
  const conversion = convertMinutesToSessions(result.netMinutes, 55, 60);
  assert.equal(conversion.isPositive, true);
  assert.equal(conversion.equivalentSessions, 1); // 1 session of 60 min
  assert.equal(conversion.remainderMinutes, 5); // 5 min remainder
  assert.equal(conversion.formattedSessionsText, 'فائض 65 دقيقة (1 حصة واحدة و 5 دقيقة)');
});

// ==========================================
// MANDATORY TEST 5: Un-evaluated week does NOT enter approved balance
// ==========================================
test('Mandatory Test 5: Un-evaluated week is excluded from approved balance', () => {
  const unreviewedWeek: WeekRecord = {
    id: 'week_unreviewed',
    startDate: '2026-10-24',
    endDate: '2026-10-29',
    status: 'unreviewed', // NOT approved!
  };

  const records: DailySessionRecord[] = [
    {
      id: 'rec_extra_unapproved',
      date: '2026-10-25',
      type: 'irregular_extra',
      scheduledDurationMinutes: 240,
      actualDurationMinutes: 240,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-25T14:00:00Z',
      updatedAt: '2026-10-25T14:00:00Z',
    },
  ];

  const weekMetrics = calculateWeekMetrics(unreviewedWeek, records, [], DEFAULT_SETTINGS);
  assert.equal(weekMetrics.isApproved, false);
  assert.equal(weekMetrics.netMinutes, 0); // Strictly 0 in approved balance

  const periodSummary = calculatePeriodSummary([unreviewedWeek], records, [], DEFAULT_SETTINGS);
  assert.equal(periodSummary.evaluatedWeeksCount, 0);
  assert.equal(periodSummary.unevaluatedWeeksCount, 1);
  assert.equal(periodSummary.approvedNetMinutes, 0); // Excluded!
  assert.equal(periodSummary.unapprovedExtraMinutes, 240);
});

// ==========================================
// Additional Robustness & Integrity Tests
// ==========================================
test('Robustness: Settings customization updates calculation parameters dynamically', () => {
  const customSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    referenceWeeklySessions: 18,
    targetBaseWeeklySessions: 15,
    referenceSessionDurationMinutes: 50,
    surplusSessionDurationMinutes: 60,
  };

  const week: WeekRecord = {
    id: 'w1',
    startDate: '2026-10-17',
    endDate: '2026-10-22',
    status: 'approved',
  };

  // 15 sessions of 50 min = 750 min completed
  const records: DailySessionRecord[] = [
    {
      id: 'r_custom',
      date: '2026-10-17',
      type: 'base',
      scheduledDurationMinutes: 750,
      actualDurationMinutes: 750,
      status: 'present',
      delayMinutes: 0,
      createdAt: '2026-10-17T08:00:00Z',
      updatedAt: '2026-10-17T08:00:00Z',
    },
  ];

  const result = calculateWeekMetrics(week, records, [], customSettings);
  // Required: 18 * 50 = 900 min
  assert.equal(result.requiredReferenceMinutes, 900);
  // Completed base: 750 min
  assert.equal(result.completedBaseMinutes, 750);
  // Deficit: 750 - 900 = -150 min (3 sessions of 50 min)
  assert.equal(result.netMinutes, -150);
});

test('Financial: Surplus valuation per 60-min session and per hour rate', () => {
  // 60 minutes surplus at 1500 DZD/session -> exactly 1500 DZD
  const fin1 = calculateFinancialAmount(60, 'per_session', 1500, 0, 60);
  assert.equal(fin1.baseAmount, 1500);
  assert.equal(fin1.beneficiary, 'teacher');

  // 65 minutes surplus at 1500 DZD/session -> (65 / 60) * 1500 = 1625 DZD
  const fin2 = calculateFinancialAmount(65, 'per_session', 1500, 0, 60);
  assert.equal(fin2.baseAmount, 1625);
  assert.equal(fin2.beneficiary, 'teacher');
});

test('Data Integrity: deduplication and schema validation', () => {
  const records = [
    { id: 'item_1', name: 'First' },
    { id: 'item_1', name: 'Updated' },
    { id: 'item_2', name: 'Second' },
  ];
  const deduped = deduplicateRecords(records);
  assert.equal(deduped.length, 2);
  assert.equal(deduped.find((i) => i.id === 'item_1')?.name, 'Updated');

  assert.equal(validateDatabaseSchema(null).isValid, false);
  assert.equal(validateDatabaseSchema({ version: 1, baseSchedule: [], dailyRecords: [], weeks: [], settings: DEFAULT_SETTINGS }).isValid, true);
});
