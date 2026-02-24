import { getDb } from '@/db';
import { cronJobCursors, systemSettings } from '@/db/schema';
import { buildCronPeriodIdempotencyKey } from '@/lib/services/idempotency-keys';
import { eq, inArray } from 'drizzle-orm';

export type CronCatchupPeriodType = 'monthly' | 'biweekly';

type CursorStatus = 'idle' | 'running' | 'failed';

export interface CronCatchupPeriodDescriptor {
  periodKey: string;
  cursorValue: string;
  periodStart: string;
  periodEnd: string;
  idempotencyKey: string;
}

export interface CronCatchupJobDefinition {
  jobKey: string;
  periodType: CronCatchupPeriodType;
  defaultMaxPeriodsPerRun: number;
  backlogStaleAfterHours: number;
  legacySettingKey?: string;
  parseLegacyPeriod?: (value: string) => Date | null;
  getLatestPeriod: (now: Date) => Date | null;
  getNextPeriod: (period: Date) => Date;
  describePeriod: (period: Date) => Omit<CronCatchupPeriodDescriptor, 'idempotencyKey'>;
  processPeriod: (input: {
    period: Date;
    descriptor: CronCatchupPeriodDescriptor;
    now: Date;
    isCatchup: boolean;
  }) => Promise<{ status: 'success' | 'partial'; summary?: Record<string, unknown> }>;
}

export interface CronCatchupProcessedPeriod {
  periodKey: string;
  status: 'success' | 'partial' | 'failed';
  summary?: Record<string, unknown>;
  error?: string;
}

export interface CronCatchupRunResult {
  jobKey: string;
  skipped: boolean;
  reason?: string;
  processedCount: number;
  backlogTotal: number;
  backlogRemaining: number;
  oldestPendingPeriodKey: string | null;
  oldestPendingAgeHours: number | null;
  staleBacklog: boolean;
  cursorStatus: CursorStatus;
  processedPeriods: CronCatchupProcessedPeriod[];
}

export interface CronCatchupStatusRow {
  jobKey: string;
  periodType: CronCatchupPeriodType;
  status: CursorStatus;
  lastSuccessfulPeriod: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  backlogCount: number;
  oldestPendingPeriodKey: string | null;
  oldestPendingAgeHours: number | null;
  staleBacklog: boolean;
  staleAfterHours: number;
  nextPeriodKey: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
}

export interface CronCatchupStatusSnapshot {
  generatedAt: string;
  jobs: CronCatchupStatusRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function diffHours(now: Date, then: Date): number {
  return Math.max(0, Math.round(((now.getTime() - then.getTime()) / (60 * 60 * 1000)) * 100) / 100);
}

function buildPendingPeriods(
  lastSuccessfulPeriod: Date | null,
  latestPeriod: Date,
  nextPeriod: (period: Date) => Date
): Date[] {
  const periods: Date[] = [];

  if (!lastSuccessfulPeriod) {
    periods.push(new Date(latestPeriod));
    return periods;
  }

  let cursor = nextPeriod(lastSuccessfulPeriod);
  while (cursor.getTime() <= latestPeriod.getTime()) {
    periods.push(new Date(cursor));
    cursor = nextPeriod(cursor);
  }

  return periods;
}

async function ensureCursor(definition: CronCatchupJobDefinition) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(cronJobCursors)
    .where(eq(cronJobCursors.jobKey, definition.jobKey))
    .limit(1);

  if (existing) {
    return existing;
  }

  let legacyPeriod: string | null = null;
  if (definition.legacySettingKey) {
    const [legacy] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, definition.legacySettingKey))
      .limit(1);

    const parsed = definition.parseLegacyPeriod?.(legacy?.value ?? '') ?? null;
    legacyPeriod = parsed ? toIsoDate(parsed) : null;
  }

  const [created] = await db
    .insert(cronJobCursors)
    .values({
      jobKey: definition.jobKey,
      periodType: definition.periodType,
      lastSuccessfulPeriod: legacyPeriod,
      status: 'idle',
      backlogCount: 0,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [resolved] = await db
    .select()
    .from(cronJobCursors)
    .where(eq(cronJobCursors.jobKey, definition.jobKey))
    .limit(1);

  if (!resolved) {
    throw new Error(`Failed to initialize cron cursor for ${definition.jobKey}`);
  }

  return resolved;
}

function withDescriptor(
  jobKey: string,
  descriptor: Omit<CronCatchupPeriodDescriptor, 'idempotencyKey'>
): CronCatchupPeriodDescriptor {
  return {
    ...descriptor,
    idempotencyKey: buildCronPeriodIdempotencyKey(jobKey, descriptor.periodKey),
  };
}

function getBacklogMetadata(
  now: Date,
  pendingPeriods: Date[],
  maxPeriods: number,
  staleAfterHours: number
): {
  backlogTotal: number;
  backlogRemaining: number;
  oldestPendingPeriodKey: string | null;
  oldestPendingAgeHours: number | null;
  staleBacklog: boolean;
} {
  const backlogTotal = pendingPeriods.length;
  const backlogRemaining = Math.max(0, backlogTotal - maxPeriods);
  const oldestPending = pendingPeriods[0] ?? null;
  const oldestPendingPeriodKey = oldestPending ? toIsoDate(oldestPending) : null;
  const oldestPendingAgeHours = oldestPending ? diffHours(now, oldestPending) : null;
  const staleBacklog = oldestPendingAgeHours !== null && oldestPendingAgeHours > staleAfterHours;

  return {
    backlogTotal,
    backlogRemaining,
    oldestPendingPeriodKey,
    oldestPendingAgeHours,
    staleBacklog,
  };
}

export async function runCronCatchupJob(
  definition: CronCatchupJobDefinition,
  options?: { now?: Date; maxPeriodsPerRun?: number }
): Promise<CronCatchupRunResult> {
  const db = getDb();
  const now = options?.now ?? new Date();
  const maxPeriods = options?.maxPeriodsPerRun ?? definition.defaultMaxPeriodsPerRun;
  const cursor = await ensureCursor(definition);
  const lastSuccessful = parseIsoDate(cursor.lastSuccessfulPeriod);
  const latestPeriod = definition.getLatestPeriod(now);

  if (!latestPeriod) {
    return {
      jobKey: definition.jobKey,
      skipped: true,
      reason: 'latest_period_unavailable',
      processedCount: 0,
      backlogTotal: 0,
      backlogRemaining: 0,
      oldestPendingPeriodKey: null,
      oldestPendingAgeHours: null,
      staleBacklog: false,
      cursorStatus: cursor.status as CursorStatus,
      processedPeriods: [],
    };
  }

  const pendingPeriods = buildPendingPeriods(lastSuccessful, latestPeriod, definition.getNextPeriod);
  if (pendingPeriods.length === 0) {
    await db
      .update(cronJobCursors)
      .set({
        status: 'idle',
        backlogCount: 0,
        lastRunAt: now,
        updatedAt: now,
      })
      .where(eq(cronJobCursors.jobKey, definition.jobKey));

    return {
      jobKey: definition.jobKey,
      skipped: true,
      reason: 'no_pending_periods',
      processedCount: 0,
      backlogTotal: 0,
      backlogRemaining: 0,
      oldestPendingPeriodKey: null,
      oldestPendingAgeHours: null,
      staleBacklog: false,
      cursorStatus: 'idle',
      processedPeriods: [],
    };
  }

  const processQueue = pendingPeriods.slice(0, Math.max(1, maxPeriods));

  await db
    .update(cronJobCursors)
    .set({
      status: 'running',
      backlogCount: pendingPeriods.length,
      lastRunAt: now,
      updatedAt: now,
      lastErrorMessage: null,
      lastErrorAt: null,
    })
    .where(eq(cronJobCursors.jobKey, definition.jobKey));

  const processedPeriods: CronCatchupProcessedPeriod[] = [];
  let processedCount = 0;
  let finalStatus: CursorStatus = 'idle';
  let failureMessage: string | null = null;

  for (const period of processQueue) {
    const descriptor = withDescriptor(definition.jobKey, definition.describePeriod(period));
    try {
      const result = await definition.processPeriod({
        period,
        descriptor,
        now,
        isCatchup: pendingPeriods.length > 1,
      });
      processedPeriods.push({
        periodKey: descriptor.periodKey,
        status: result.status,
        summary: result.summary,
      });
      processedCount += 1;

      await db
        .update(cronJobCursors)
        .set({
          lastSuccessfulPeriod: descriptor.cursorValue,
          lastSuccessAt: now,
          updatedAt: now,
        })
        .where(eq(cronJobCursors.jobKey, definition.jobKey));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown catch-up failure';
      processedPeriods.push({
        periodKey: descriptor.periodKey,
        status: 'failed',
        error: message,
      });
      failureMessage = message;
      finalStatus = 'failed';
      break;
    }
  }

  const remaining = Math.max(0, pendingPeriods.length - processedCount);
  if (!failureMessage && remaining > 0) {
    finalStatus = 'running';
  }
  const oldestPending = remaining > 0 ? pendingPeriods[processedCount] : null;
  const oldestPendingPeriodKey = oldestPending ? toIsoDate(oldestPending) : null;
  const oldestPendingAgeHours = oldestPending ? diffHours(now, oldestPending) : null;
  const staleBacklog =
    oldestPendingAgeHours !== null && oldestPendingAgeHours > definition.backlogStaleAfterHours;

  await db
    .update(cronJobCursors)
    .set({
      status: finalStatus,
      backlogCount: remaining,
      lastRunAt: now,
      updatedAt: now,
      lastErrorMessage: failureMessage,
      lastErrorAt: failureMessage ? now : null,
    })
    .where(eq(cronJobCursors.jobKey, definition.jobKey));

  return {
    jobKey: definition.jobKey,
    skipped: false,
    processedCount,
    backlogTotal: pendingPeriods.length,
    backlogRemaining: remaining,
    oldestPendingPeriodKey,
    oldestPendingAgeHours,
    staleBacklog,
    cursorStatus: finalStatus,
    processedPeriods,
  };
}

export async function buildCronCatchupStatusSnapshot(
  definitions: CronCatchupJobDefinition[],
  now: Date = new Date()
): Promise<CronCatchupStatusSnapshot> {
  const db = getDb();

  for (const definition of definitions) {
    await ensureCursor(definition);
  }

  const rows = await db
    .select()
    .from(cronJobCursors)
    .where(
      inArray(
        cronJobCursors.jobKey,
        definitions.map((definition) => definition.jobKey)
      )
    );

  const rowByJobKey = new Map(rows.map((row) => [row.jobKey, row]));
  const jobs: CronCatchupStatusRow[] = [];

  for (const definition of definitions) {
    const row = rowByJobKey.get(definition.jobKey);
    if (!row) continue;

    const lastSuccessful = parseIsoDate(row.lastSuccessfulPeriod);
    const latest = definition.getLatestPeriod(now);

    const pending = latest
      ? buildPendingPeriods(lastSuccessful, latest, definition.getNextPeriod)
      : [];

    const backlog = getBacklogMetadata(
      now,
      pending,
      definition.defaultMaxPeriodsPerRun,
      definition.backlogStaleAfterHours
    );

    const nextPeriodKey = pending[0] ? toIsoDate(pending[0]) : null;

    jobs.push({
      jobKey: definition.jobKey,
      periodType: definition.periodType,
      status: row.status as CursorStatus,
      lastSuccessfulPeriod: row.lastSuccessfulPeriod,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      backlogCount: pending.length,
      oldestPendingPeriodKey: backlog.oldestPendingPeriodKey,
      oldestPendingAgeHours: backlog.oldestPendingAgeHours,
      staleBacklog: backlog.staleBacklog,
      staleAfterHours: definition.backlogStaleAfterHours,
      nextPeriodKey,
      lastErrorMessage: row.lastErrorMessage,
      lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
    });
  }

  return {
    generatedAt: now.toISOString(),
    jobs,
  };
}

export function getUtcMonthPeriodStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function getNextUtcMonthPeriod(period: Date): Date {
  return new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function startOfUtcWeekMonday(date: Date): Date {
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset, 0, 0, 0, 0));
}

export function getIsoWeek(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

export function getLatestBiweeklyPeriodEnd(now: Date): Date {
  const monday = startOfUtcWeekMonday(now);
  const runMonday = getIsoWeek(monday) % 2 === 0
    ? monday
    : new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() - 7, 0, 0, 0, 0));

  return new Date(Date.UTC(runMonday.getUTCFullYear(), runMonday.getUTCMonth(), runMonday.getUTCDate() - 1, 0, 0, 0, 0));
}

export function getNextBiweeklyPeriodEnd(periodEnd: Date): Date {
  return new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate() + 14, 0, 0, 0, 0));
}

export function describeBiweeklyPeriod(periodEnd: Date): Omit<CronCatchupPeriodDescriptor, 'idempotencyKey'> {
  const end = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate(), 0, 0, 0, 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 13, 0, 0, 0, 0));
  const endKey = toIsoDate(end);

  return {
    periodKey: `${toIsoDate(start)}..${endKey}`,
    cursorValue: endKey,
    periodStart: toIsoDate(start),
    periodEnd: endKey,
  };
}

export function describeMonthlyPeriod(periodStart: Date): Omit<CronCatchupPeriodDescriptor, 'idempotencyKey'> {
  const start = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1, 0, 0, 0, 0));
  const key = toIsoDate(start);

  return {
    periodKey: key,
    cursorValue: key,
    periodStart: key,
    periodEnd: key,
  };
}

export function parseMonthlyLegacyPeriod(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  return parseIsoDate(`${value}-01`);
}

export function parseDateLegacyPeriod(value: string): Date | null {
  return parseIsoDate(value);
}
