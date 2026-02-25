import { getDb } from '@/db';
import {
  cronJobCursors,
  errorLog,
  escalationQueue,
  reportDeliveries,
  webhookLog,
} from '@/db/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

type CountRow = { count: number };

export interface SoloReliabilitySummary {
  generatedAt: string;
  failedCronJobs: Array<{
    jobKey: string;
    status: string;
    backlogCount: number;
    lastErrorAt: string | null;
    lastErrorMessage: string | null;
  }>;
  webhookFailures24h: {
    total: number;
    byEventType: Array<{
      eventType: string;
      count: number;
    }>;
  };
  openEscalations: {
    pending: number;
    assigned: number;
    inProgress: number;
    slaBreaches: number;
  };
  reportDelivery: {
    failedTotal: number;
    failed24h: number;
    queuedRetries: number;
  };
  errorLog: {
    unresolvedTotal: number;
    created24h: number;
    topSources24h: Array<{
      source: string;
      count: number;
    }>;
  };
}

function toIso(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString();
}

function asCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function countFromRow(rows: CountRow[]): number {
  return asCount(rows[0]?.count);
}

export async function getSoloReliabilitySummary(): Promise<SoloReliabilitySummary> {
  const db = getDb();
  const now = new Date();
  const since24h = new Date(now.getTime() - DAY_MS);

  const sourceExpr = sql<string>`coalesce(${errorLog.errorDetails}->>'source', 'unknown')`;

  const [
    cronRows,
    webhookRows,
    pendingEscalations,
    assignedEscalations,
    inProgressEscalations,
    slaBreaches,
    reportFailedTotal,
    reportFailed24h,
    queuedRetries,
    unresolvedErrors,
    errorsCreated24h,
    topErrorSources,
  ] = await Promise.all([
    db
      .select({
        jobKey: cronJobCursors.jobKey,
        status: cronJobCursors.status,
        backlogCount: cronJobCursors.backlogCount,
        lastErrorAt: cronJobCursors.lastErrorAt,
        lastErrorMessage: cronJobCursors.lastErrorMessage,
      })
      .from(cronJobCursors)
      .where(sql`${cronJobCursors.status} = 'failed' OR ${cronJobCursors.backlogCount} > 0`)
      .orderBy(desc(cronJobCursors.backlogCount), desc(cronJobCursors.lastErrorAt))
      .limit(10),

    db
      .select({
        eventType: webhookLog.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(webhookLog)
      .where(and(
        gte(webhookLog.createdAt, since24h),
        sql`${webhookLog.responseStatus} >= 400`
      ))
      .groupBy(webhookLog.eventType)
      .orderBy(desc(sql`count(*)`))
      .limit(8),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(escalationQueue)
      .where(eq(escalationQueue.status, 'pending')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(escalationQueue)
      .where(eq(escalationQueue.status, 'assigned')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(escalationQueue)
      .where(eq(escalationQueue.status, 'in_progress')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(escalationQueue)
      .where(and(
        eq(escalationQueue.slaBreach, true),
        sql`${escalationQueue.status} in ('pending','assigned','in_progress')`
      )),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportDeliveries)
      .where(eq(reportDeliveries.state, 'failed')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportDeliveries)
      .where(and(
        eq(reportDeliveries.state, 'failed'),
        gte(reportDeliveries.failedAt, since24h)
      )),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportDeliveries)
      .where(and(
        eq(reportDeliveries.state, 'queued'),
        sql`${reportDeliveries.attemptCount} > 0`
      )),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorLog)
      .where(eq(errorLog.resolved, false)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorLog)
      .where(gte(errorLog.createdAt, since24h)),

    db
      .select({
        source: sourceExpr,
        count: sql<number>`count(*)::int`,
      })
      .from(errorLog)
      .where(gte(errorLog.createdAt, since24h))
      .groupBy(sourceExpr)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
  ]);

  const webhookFailuresByType = webhookRows.map((row) => ({
    eventType: row.eventType || 'unknown',
    count: asCount(row.count),
  }));

  return {
    generatedAt: now.toISOString(),
    failedCronJobs: cronRows.map((row) => ({
      jobKey: row.jobKey,
      status: row.status,
      backlogCount: row.backlogCount ?? 0,
      lastErrorAt: toIso(row.lastErrorAt),
      lastErrorMessage: row.lastErrorMessage ?? null,
    })),
    webhookFailures24h: {
      total: webhookFailuresByType.reduce((sum, item) => sum + item.count, 0),
      byEventType: webhookFailuresByType,
    },
    openEscalations: {
      pending: countFromRow(pendingEscalations),
      assigned: countFromRow(assignedEscalations),
      inProgress: countFromRow(inProgressEscalations),
      slaBreaches: countFromRow(slaBreaches),
    },
    reportDelivery: {
      failedTotal: countFromRow(reportFailedTotal),
      failed24h: countFromRow(reportFailed24h),
      queuedRetries: countFromRow(queuedRetries),
    },
    errorLog: {
      unresolvedTotal: countFromRow(unresolvedErrors),
      created24h: countFromRow(errorsCreated24h),
      topSources24h: topErrorSources.map((row) => ({
        source: row.source || 'unknown',
        count: asCount(row.count),
      })),
    },
  };
}
