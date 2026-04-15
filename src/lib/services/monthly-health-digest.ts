import { getDb } from '@/db';
import { clients, cronJobCursors, subscriptions, agencyMessages, leads } from '@/db/schema';
import { eq, gte, and, count, sum, sql } from 'drizzle-orm';
import { getCapacityEstimate } from '@/lib/services/capacity-tracking';

export interface MonthlyDigest {
  generatedAt: string;
  sections: {
    clientOverview: {
      active: number;
      paused: number;
      cancelled: number;
      newThisMonth: number;
      churnedThisMonth: number;
    };
    capacity: {
      totalWeeklyHours: number;
      maxHours: number;
      utilizationPercent: number;
      alertLevel: string;
    };
    automationHealth: {
      totalJobs: number;
      healthy: number;
      failed: number;
      backlogged: number;
      jobs: {
        key: string;
        status: string;
        lastRunAt: string | null;
        backlog: number;
      }[];
    };
    guaranteeTracker: {
      activeGuarantees: number;
      approaching30Days: number;
      fulfilled: number;
    };
    keyMetrics: {
      messagesSentThisMonth: number;
      leadsCreatedThisMonth: number;
      totalWonRevenueCents: number;
    };
  };
}

export async function generateMonthlyDigest(): Promise<MonthlyDigest> {
  const db = getDb();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    clientStatusRows,
    newThisMonthRows,
    churnedThisMonthRows,
    capacityEstimate,
    allCronJobs,
    guaranteeRows,
    messageCountRows,
    leadsCreatedRows,
    wonRevenueRows,
  ] = await Promise.all([
    // Client status counts
    db
      .select({
        status: clients.status,
        cnt: count(clients.id),
      })
      .from(clients)
      .groupBy(clients.status),

    // New clients this month
    db
      .select({ cnt: count(clients.id) })
      .from(clients)
      .where(gte(clients.createdAt, firstOfMonth)),

    // Churned clients this month (cancelled AND updatedAt >= first of month)
    db
      .select({ cnt: count(clients.id) })
      .from(clients)
      .where(
        and(
          eq(clients.status, 'cancelled'),
          gte(clients.updatedAt, firstOfMonth)
        )
      ),

    // Capacity
    getCapacityEstimate(),

    // All cron job cursors
    db.select().from(cronJobCursors),

    // Guarantee tracker: subscriptions with active guarantee fields
    db
      .select({
        guaranteeStatus: subscriptions.guaranteeStatus,
        guaranteeEndsAt: subscriptions.guaranteeEndsAt,
        guaranteeFulfilledAt: subscriptions.guaranteeFulfilledAt,
      })
      .from(subscriptions)
      .where(sql`${subscriptions.guaranteeStartAt} IS NOT NULL`),

    // Messages sent this month (outbound)
    db
      .select({ cnt: count(agencyMessages.id) })
      .from(agencyMessages)
      .where(
        and(
          eq(agencyMessages.direction, 'outbound'),
          gte(agencyMessages.createdAt, firstOfMonth)
        )
      ),

    // Leads created this month
    db
      .select({ cnt: count(leads.id) })
      .from(leads)
      .where(gte(leads.createdAt, firstOfMonth)),

    // Won revenue this month
    db
      .select({ total: sum(leads.confirmedRevenue) })
      .from(leads)
      .where(
        and(
          eq(leads.status, 'won'),
          gte(leads.updatedAt, firstOfMonth),
          sql`${leads.confirmedRevenue} IS NOT NULL`
        )
      ),
  ]);

  // --- Client Overview ---
  const statusMap: Record<string, number> = {};
  for (const row of clientStatusRows) {
    if (row.status) statusMap[row.status] = Number(row.cnt);
  }

  const clientOverview = {
    active: statusMap['active'] ?? 0,
    paused: statusMap['paused'] ?? 0,
    cancelled: statusMap['cancelled'] ?? 0,
    newThisMonth: Number(newThisMonthRows[0]?.cnt ?? 0),
    churnedThisMonth: Number(churnedThisMonthRows[0]?.cnt ?? 0),
  };

  // --- Capacity ---
  const capacity = {
    totalWeeklyHours: capacityEstimate.totalWeeklyHours,
    maxHours: capacityEstimate.maxCapacityHours,
    utilizationPercent: capacityEstimate.utilizationPercent,
    alertLevel: capacityEstimate.alertLevel,
  };

  // --- Automation Health ---
  const jobSummaries = allCronJobs.map((job) => ({
    key: job.jobKey,
    status: job.status,
    lastRunAt: job.lastRunAt ? job.lastRunAt.toISOString() : null,
    backlog: job.backlogCount,
  }));

  const healthyCnt = jobSummaries.filter(
    (j) => j.status === 'idle' && j.backlog === 0
  ).length;
  const failedCnt = jobSummaries.filter((j) => j.status === 'failed').length;
  const backloggedCnt = jobSummaries.filter(
    (j) => j.backlog > 0 && j.status !== 'failed'
  ).length;

  const automationHealth = {
    totalJobs: jobSummaries.length,
    healthy: healthyCnt,
    failed: failedCnt,
    backlogged: backloggedCnt,
    jobs: jobSummaries,
  };

  // --- Guarantee Tracker ---
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let activeGuarantees = 0;
  let approaching30Days = 0;
  let fulfilled = 0;

  for (const row of guaranteeRows) {
    const status = row.guaranteeStatus;
    if (
      status === 'proof_pending' ||
      status === 'proof_passed' ||
      status === 'recovery_pending'
    ) {
      activeGuarantees++;
      if (row.guaranteeEndsAt && row.guaranteeEndsAt <= thirtyDaysFromNow) {
        approaching30Days++;
      }
    } else if (
      status === 'fulfilled' ||
      status === 'recovery_passed' ||
      status === 'proof_failed_refund_review' ||
      status === 'recovery_failed_refund_review'
    ) {
      fulfilled++;
    }
  }

  const guaranteeTracker = { activeGuarantees, approaching30Days, fulfilled };

  // --- Key Metrics ---
  const keyMetrics = {
    messagesSentThisMonth: Number(messageCountRows[0]?.cnt ?? 0),
    leadsCreatedThisMonth: Number(leadsCreatedRows[0]?.cnt ?? 0),
    totalWonRevenueCents: Number(wonRevenueRows[0]?.total ?? 0),
  };

  return {
    generatedAt: now.toISOString(),
    sections: {
      clientOverview,
      capacity,
      automationHealth,
      guaranteeTracker,
      keyMetrics,
    },
  };
}
