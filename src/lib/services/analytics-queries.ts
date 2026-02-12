import { getDb } from '@/db';
import { analyticsDaily, analyticsMonthly, funnelEvents } from '@/db/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';

/**
 * Get dashboard summary for a client
 * Returns monthly metrics and 7-day trend data
 * @param clientId - Client UUID
 * @returns Object with monthly data, daily trend, and current month string
 */
export async function getClientDashboardSummary(clientId: string) {
  const db = getDb();

  // Get current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get this month's data
  const [monthly] = await db
    .select()
    .from(analyticsMonthly)
    .where(
      and(
        eq(analyticsMonthly.clientId, clientId),
        eq(analyticsMonthly.month, currentMonth)
      )
    )
    .limit(1);

  // Get last 7 days for trend
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailyTrend = await db
    .select()
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.clientId, clientId),
        gte(analyticsDaily.date, sevenDaysAgo.toISOString().split('T')[0])
      )
    )
    .orderBy(analyticsDaily.date);

  return {
    monthly,
    dailyTrend,
    currentMonth,
  };
}

/**
 * Get conversion funnel data
 * Returns stage-by-stage counts, values, and conversion rates
 * @param clientId - Client UUID
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Array of funnel stages with counts and conversion rates
 */
export async function getConversionFunnel(
  clientId: string,
  startDate: string,
  endDate: string
) {
  const db = getDb();

  const funnelStages = [
    'lead_created',
    'first_response',
    'qualified',
    'appointment_booked',
    'quote_sent',
    'job_won',
  ];

  const counts = await db
    .select({
      eventType: funnelEvents.eventType,
      count: sql<number>`count(distinct ${funnelEvents.leadId})`,
      totalValue: sql<number>`sum(${funnelEvents.valueCents})`,
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.clientId, clientId),
        gte(funnelEvents.createdAt, new Date(startDate)),
        lte(funnelEvents.createdAt, new Date(endDate)),
        sql`${funnelEvents.eventType} = ANY(${funnelStages})`
      )
    )
    .groupBy(funnelEvents.eventType);

  const countMap = Object.fromEntries(
    counts.map((c) => [
      c.eventType,
      { count: Number(c.count), value: Number(c.totalValue) || 0 },
    ])
  );

  return funnelStages.map((stage, index) => {
    const current = countMap[stage]?.count || 0;
    const previous =
      index > 0 ? countMap[funnelStages[index - 1]]?.count || 0 : current;
    const conversionRate =
      previous > 0 ? Math.round((current / previous) * 100) : 0;

    return {
      stage,
      count: current,
      value: countMap[stage]?.value || 0,
      conversionRate,
    };
  });
}

/**
 * Get lead source breakdown
 * Returns leads, conversions, and revenue by source
 * @param clientId - Client UUID
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Array of sources with metrics
 */
export async function getLeadSourceBreakdown(
  clientId: string,
  startDate: string,
  endDate: string
) {
  const db = getDb();

  return db
    .select({
      source: funnelEvents.source,
      leads: sql<number>`count(distinct ${funnelEvents.leadId})`,
      conversions: sql<number>`count(distinct ${funnelEvents.leadId}) filter (where ${funnelEvents.eventType} = 'job_won')`,
      revenue: sql<number>`sum(${funnelEvents.valueCents}) filter (where ${funnelEvents.eventType} = 'job_won')`,
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.clientId, clientId),
        gte(funnelEvents.createdAt, new Date(startDate)),
        lte(funnelEvents.createdAt, new Date(endDate))
      )
    )
    .groupBy(funnelEvents.source);
}

/**
 * Get response time distribution
 * Returns count of days in each response time bucket
 * @param clientId - Client UUID
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Array of time buckets with counts
 */
export async function getResponseTimeDistribution(
  clientId: string,
  startDate: string,
  endDate: string
) {
  const db = getDb();

  const distribution = await db
    .select({
      bucket: sql<string>`
        CASE
          WHEN ${analyticsDaily.avgResponseTimeSeconds} <= 60 THEN 'Under 1 min'
          WHEN ${analyticsDaily.avgResponseTimeSeconds} <= 300 THEN '1-5 min'
          WHEN ${analyticsDaily.avgResponseTimeSeconds} <= 900 THEN '5-15 min'
          WHEN ${analyticsDaily.avgResponseTimeSeconds} <= 3600 THEN '15-60 min'
          ELSE 'Over 1 hour'
        END
      `,
      count: count(),
    })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.clientId, clientId),
        gte(analyticsDaily.date, startDate),
        lte(analyticsDaily.date, endDate),
        sql`${analyticsDaily.avgResponseTimeSeconds} IS NOT NULL`
      )
    )
    .groupBy(sql`1`);

  return distribution;
}

/**
 * Get month-over-month comparison
 * Returns last N months of data in chronological order
 * @param clientId - Client UUID
 * @param months - Number of months to fetch (default 6)
 * @returns Array of monthly analytics records
 */
export async function getMonthlyComparison(
  clientId: string,
  months: number = 6
) {
  const db = getDb();

  const data = await db
    .select()
    .from(analyticsMonthly)
    .where(eq(analyticsMonthly.clientId, clientId))
    .orderBy(desc(analyticsMonthly.month))
    .limit(months);

  return data.reverse();
}
