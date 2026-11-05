/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LiquidationMethod = 'per_session' | 'per_hour';
export type WeekStatus = 'unreviewed' | 'in_progress' | 'approved';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'cancelled_by_school' | 'unrecorded';
export type SessionType = 'base' | 'recurring_support' | 'irregular_extra' | 'dated_extra';
export type SchoolCancellationPolicy = 'waived_as_completed' | 'deduct_from_target';

export type TrainingAssignmentType = 'training' | 'assignment';
export type TrainingAssignmentStatus = 'completed' | 'in_progress';

export interface TrainingAssignment {
  id: string;
  type: TrainingAssignmentType; // 'training' (تكوين) | 'assignment' (تكليف)
  title?: string; // عنوان النشاط (اختياري)
  date: string; // YYYY-MM-DD
  durationMinutes: number; // المدة بالدقائق الصحيحة (0 إذا كان قيد الإنجاز)
  notes?: string; // ملاحظة تفصيلية
  status: TrainingAssignmentStatus; // 'completed' (منجز) | 'in_progress' (قيد الإنجاز)
  academicYear: string; // الموسم الدراسي (مثلاً 2026-2027)
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  // Weekly Session Volumes
  referenceWeeklySessions: number; // e.g. 16 sessions (reference volume)
  targetBaseWeeklySessions: number; // e.g. 14 sessions (morning base volume)
  referenceSessionDurationMinutes: number; // e.g. 55 minutes (base session duration)
  surplusSessionDurationMinutes: number; // e.g. 60 minutes (surplus evaluation session duration)

  // Academic Season & Trainings Quota
  academicYear: string; // e.g. '2026-2027'
  trainingTargetHours: number; // e.g. 16 hours (= 960 minutes)

  // Backward-compatibility aliases
  referenceWeeklyHours?: number; // legacy alias
  targetBaseWeeklyHours?: number; // legacy alias

  // Calendar configuration
  weekStartDay: number; // 6 = Saturday
  weekEndDay: number; // 4 = Thursday
  holidayDay: number; // 5 = Friday

  // Liquidation & Finance
  liquidationMethod: LiquidationMethod;
  pricePerSession: number;
  pricePerHour: number;
  currency: string; // e.g. 'دج'
  dateFormat: string; // 'YYYY-MM-DD'
  schoolCancellationPolicy: SchoolCancellationPolicy;
  autoSave: boolean;
  backupReminderEnabled?: boolean;
  backupReminderIntervalDays?: number;
  lastBackupDate?: string;
  autoSaveDebounceMs?: number;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

export interface BaseScheduleItem {
  id: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  startTime: string; // '08:00'
  endTime: string; // '08:55'
  durationMinutes: number; // e.g. 55
  subject?: string;
  gradeClass?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupportScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime?: string;
  subject?: string;
  groupName?: string;
  defaultDurationMinutes?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailySessionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: SessionType;
  baseScheduleId?: string;
  supportScheduleId?: string;
  subject?: string;
  groupName?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledDurationMinutes: number;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes: number; // minutes completed
  status: AttendanceStatus;
  delayMinutes: number; // > 0 if status === 'late'
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeekRecord {
  id: string; // e.g. "week_2026-10-17"
  startDate: string; // Saturday YYYY-MM-DD
  endDate: string; // Thursday YYYY-MM-DD
  status: WeekStatus;
  approvalDate?: string;
  reopenedDate?: string;
  reopenReason?: string;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 'create' | 'update' | 'delete' | 'approve_week' | 'reopen_week' | 'approve_liquidation' | 'restore_backup';
  entity: string;
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface LiquidationSummarySnapshot {
  evaluatedWeeksCount: number;
  unevaluatedWeeksCount: number;
  totalRequiredReferenceMinutes: number;
  totalBaseCompletedMinutes: number;
  totalExtraCompletedMinutes: number;
  totalAbsencesCount: number;
  totalAbsencesMinutes: number;
  totalDelaysCount: number;
  totalDelaysMinutes: number;
  netMinutes: number;
  hours: number;
  minutes: number;
  equivalentSessions: number;
  remainderMinutes: number;
  rateApplied: number;
  methodApplied: LiquidationMethod;
  manualAdjustment: number;
  manualAdjustmentReason?: string;
  financialAmount: number;
  beneficiary: 'teacher' | 'school' | 'balanced';
  evaluatedWeekIds: string[];
}

export interface LiquidationRecord {
  id: string;
  createdAt: string;
  approvedAt?: string;
  startDate: string;
  endDate: string;
  calculationMethod: LiquidationMethod;
  rate: number;
  manualAdjustment: number;
  manualAdjustmentReason?: string;
  notes?: string;
  status: 'draft' | 'approved';
  snapshot: LiquidationSummarySnapshot;
}

export interface AppDatabaseSchema {
  version: number;
  exportedAt: string;
  appName: string;
  settings: AppSettings;
  baseSchedule: BaseScheduleItem[];
  supportSchedule: SupportScheduleItem[];
  dailyRecords: DailySessionRecord[];
  weeks: WeekRecord[];
  liquidations: LiquidationRecord[];
  auditLogs: AuditLogEntry[];
  trainingsAssignments?: TrainingAssignment[];
}
