import {
  getDb,
  analyticsDaily,
  analyticsWeekly,
  analyticsMonthly,
  platformAnalytics,
  funnelEvents,
  leads,
  conversations,
  clients,
  escalationQueue,
  apiUsageMonthly,
  leadContext,
} from '@/db';
import { eq, and, gte, lte, sql, count, sum, avg } from 'drizzle-orm';

/**
 * Calculate daily analytics for a client
 */
export async function calculateDailyAnalytics(
  clientId: string,
  date: string
): Promise<void> {
  const db = getDb();
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);

  // Count new leads
  const [leadCounts] = await db
    .select({
      total: count(),
      missedCalls: sql<number>`count(*) filter (where ${leads.source} = 'missed_call')`,
      webForms: sql<number>`count(*) filter (where ${leads.source} = 'form')`,
      referrals: sql<number>`count(*) filter (where ${leads.source} = 'referral')`,
    })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        gte(leads.createdAt, startOfDay),
        lte(leads.createdAt, endOfDay)
      )
    );

  // Count messages (conversations table)
  const [messageCounts] = await db
    .select({
      inbound: sql<number>`count(*) filter (where ${conversations.direction} = 'inbound')`,
      outbound: sql<number>`count(*) filter (where ${conversations.direction} = 'outbound')`,
      aiResponses: sql<number>`count(*) filter (where ${conversations.messageType} = 'ai_response')`,
      humanResponses: sql<number>`count(*) filter (where ${conversations.messageType} = 'contractor_response')`,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.clientId, clientId),
        gte(conversations.createdAt, startOfDay),
        lte(conversations.createdAt, endOfDay)
      )
    );

  // Count escalations
  const [escalationCount] = await db
    .select({ count: count() })
    .from(escalationQueue)
    .where(
      and(
        eq(escalationQueue.clientId, clientId),
        gte(escalationQueue.createdAt, startOfDay),
        lte(escalationQueue.createdAt, endOfDay)
      )
    );

  // Count funnel events
  const funnelCounts = await db
    .select({
      eventType: funnelEvents.eventType,
      count: count(),
      totalValue: sum(funnelEvents.valueCents),
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.clientId, clientId),
        gte(funnelEvents.createdAt, startOfDay),
        lte(funnelEvents.createdAt, endOfDay)
      )
    )
    .groupBy(funnelEvents.eventType);

  const eventMap = Object.fromEntries(
    funnelCounts.map((e) => [
      e.eventType,
      { count: Number(e.count), value: Number(e.totalValue) || 0 },
    ])
  );

  // Get lead stage distribution
  const stageCounts = await db
    .select({
      stage: leadContext.stage,
      count: count(),
    })
    .from(leadContext)
    .where(eq(leadContext.clientId, clientId))
    .groupBy(leadContext.stage);

  const stageMap = Object.fromEntries(
    stageCounts.map((s) => [s.stage, Number(s.count)])
  );

  // Calculate average response time
  const avgResponseTime = await calculateAvgResponseTime(
    clientId,
    startOfDay,
    endOfDay
  );

  const newLeadsTotal = Number(leadCounts?.total) || 0;
  const missedCalls = Number(leadCounts?.missedCalls) || 0;
  const webForms = Number(leadCounts?.webForms) || 0;
  const referrals = Number(leadCounts?.referrals) || 0;

  const values = {
    clientId,
    date,
    newLeads: newLeadsTotal,
    leadsFromMissedCalls: missedCalls,
    leadsFromWebForms: webForms,
    leadsFromReferrals: referrals,
    leadsFromOther: newLeadsTotal - missedCalls - webForms - referrals,
    inboundMessages: Number(messageCounts?.inbound) || 0,
    outboundMessages: Number(messageCounts?.outbound) || 0,
    aiResponses: Number(messageCounts?.aiResponses) || 0,
    humanResponses: Number(messageCounts?.humanResponses) || 0,
    escalations: Number(escalationCount?.count) || 0,
    avgResponseTimeSeconds: avgResponseTime,
    appointmentsBooked: eventMap['appointment_booked']?.count || 0,
    quotesRequested: eventMap['quote_requested']?.count || 0,
    quotesSent: eventMap['quote_sent']?.count || 0,
    jobsWon: eventMap['job_won']?.count || 0,
    jobsLost: eventMap['job_lost']?.count || 0,
    revenueAttributedCents: eventMap['job_won']?.value || 0,
    paymentsCollectedCents: eventMap['payment_received']?.value || 0,
    reviewRequestsSent: eventMap['review_requested']?.count || 0,
    reviewsReceived: eventMap['review_received']?.count || 0,
    leadsNew: stageMap['new'] || 0,
    leadsQualifying: stageMap['qualifying'] || 0,
    leadsNurturing: stageMap['nurturing'] || 0,
    leadsHot: stageMap['hot'] || 0,
    leadsBooked: stageMap['booked'] || 0,
    leadsLost: stageMap['lost'] || 0,
    updatedAt: new Date(),
  };

  // Upsert daily analytics
  await db
    .insert(analyticsDaily)
    .values(values)
    .onConflictDoUpdate({
      target: [analyticsDaily.clientId, analyticsDaily.date],
      set: { ...values },
    });
}

/**
 * Calculate average response time for a date range
 */
async function calculateAvgResponseTime(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<number | null> {
  const db = getDb();

  const result = await db.execute(sql`
    WITH message_pairs AS (
      SELECT
        m1.id as inbound_id,
        m1.created_at as inbound_time,
        MIN(m2.created_at) as response_time
      FROM conversations m1
      LEFT JOIN conversations m2 ON
        m1.lead_id = m2.lead_id AND
        m2.direction = 'outbound' AND
        m2.created_at > m1.created_at
      WHERE
        m1.client_id = ${clientId} AND
        m1.direction = 'inbound' AND
        m1.created_at >= ${startDate} AND
        m1.created_at <= ${endDate}
      GROUP BY m1.id, m1.created_at
    )
    SELECT AVG(EXTRACT(EPOCH FROM (response_time - inbound_time))) as avg_seconds
    FROM message_pairs
    WHERE response_time IS NOT NULL
  `);

  const row = result.rows[0] as { avg_seconds?: string | number | null } | undefined;
  return row?.avg_seconds ? Math.round(Number(row.avg_seconds)) : null;
}

/**
 * Calculate weekly analytics from daily data
 */
export async function calculateWeeklyAnalytics(
  clientId: string,
  weekStart: string // Monday date
): Promise<void> {
  const db = getDb();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // Aggregate daily data
  const [aggregated] = await db
    .select({
      newLeads: sum(analyticsDaily.newLeads),
      totalConversations: sum(analyticsDaily.totalConversations),
      appointmentsBooked: sum(analyticsDaily.appointmentsBooked),
      jobsWon: sum(analyticsDaily.jobsWon),
      revenueAttributedCents: sum(analyticsDaily.revenueAttributedCents),
      paymentsCollectedCents: sum(analyticsDaily.paymentsCollectedCents),
      avgResponseTimeSeconds: avg(analyticsDaily.avgResponseTimeSeconds),
    })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.clientId, clientId),
        gte(analyticsDaily.date, weekStart),
        lte(analyticsDaily.date, weekEndStr)
      )
    );

  // Calculate conversion rates
  const newLeads = Number(aggregated?.newLeads) || 0;
  const appointments = Number(aggregated?.appointmentsBooked) || 0;
  const jobsWon = Number(aggregated?.jobsWon) || 0;

  const leadToAppointmentRate =
    newLeads > 0 ? Math.round((appointments / newLeads) * 10000) : null;
  const appointmentToJobRate =
    appointments > 0 ? Math.round((jobsWon / appointments) * 10000) : null;
  const overallConversionRate =
    newLeads > 0 ? Math.round((jobsWon / newLeads) * 10000) : null;

  // Get previous week for comparison
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];

  const [prevWeek] = await db
    .select()
    .from(analyticsWeekly)
    .where(
      and(
        eq(analyticsWeekly.clientId, clientId),
        eq(analyticsWeekly.weekStart, prevWeekStartStr)
      )
    )
    .limit(1);

  const leadsChangePercent = prevWeek?.newLeads
    ? Math.round(((newLeads - prevWeek.newLeads) / prevWeek.newLeads) * 100)
    : null;

  const currentRevenue = Number(aggregated?.revenueAttributedCents) || 0;
  const revenueChangePercent = prevWeek?.revenueAttributedCents
    ? Math.round(
        ((currentRevenue - prevWeek.revenueAttributedCents) /
          prevWeek.revenueAttributedCents) *
          100
      )
    : null;

  const values = {
    clientId,
    weekStart,
    newLeads,
    totalConversations: Number(aggregated?.totalConversations) || 0,
    appointmentsBooked: appointments,
    jobsWon,
    revenueAttributedCents: currentRevenue,
    paymentsCollectedCents: Number(aggregated?.paymentsCollectedCents) || 0,
    leadToAppointmentRate,
    appointmentToJobRate,
    overallConversionRate,
    avgResponseTimeSeconds: aggregated?.avgResponseTimeSeconds
      ? Math.round(Number(aggregated.avgResponseTimeSeconds))
      : null,
    leadsChangePercent,
    revenueChangePercent,
  };

  // Upsert weekly analytics
  await db
    .insert(analyticsWeekly)
    .values(values)
    .onConflictDoUpdate({
      target: [analyticsWeekly.clientId, analyticsWeekly.weekStart],
      set: { ...values },
    });
}

/**
 * Calculate monthly analytics
 */
export async function calculateMonthlyAnalytics(
  clientId: string,
  month: string // "2026-02"
): Promise<void> {
  const db = getDb();
  const startDate = `${month}-01`;
  const endDate = new Date(
    parseInt(month.split('-')[0]),
    parseInt(month.split('-')[1]),
    0
  )
    .toISOString()
    .split('T')[0];

  // Aggregate from daily
  const [aggregated] = await db
    .select({
      newLeads: sum(analyticsDaily.newLeads),
      appointmentsBooked: sum(analyticsDaily.appointmentsBooked),
      quotesSent: sum(analyticsDaily.quotesSent),
      jobsWon: sum(analyticsDaily.jobsWon),
      jobsLost: sum(analyticsDaily.jobsLost),
      revenueAttributedCents: sum(analyticsDaily.revenueAttributedCents),
      paymentsCollectedCents: sum(analyticsDaily.paymentsCollectedCents),
      inboundMessages: sum(analyticsDaily.inboundMessages),
      outboundMessages: sum(analyticsDaily.outboundMessages),
      aiResponses: sum(analyticsDaily.aiResponses),
      humanResponses: sum(analyticsDaily.humanResponses),
      escalations: sum(analyticsDaily.escalations),
      reviewsReceived: sum(analyticsDaily.reviewsReceived),
    })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.clientId, clientId),
        gte(analyticsDaily.date, startDate),
        lte(analyticsDaily.date, endDate)
      )
    );

  const newLeads = Number(aggregated?.newLeads) || 0;
  const jobsWon = Number(aggregated?.jobsWon) || 0;
  const revenue = Number(aggregated?.revenueAttributedCents) || 0;
  const totalMessages =
    (Number(aggregated?.inboundMessages) || 0) +
    (Number(aggregated?.outboundMessages) || 0);
  const aiResponses = Number(aggregated?.aiResponses) || 0;
  const escalations = Number(aggregated?.escalations) || 0;

  // Calculate rates
  const leadToJobRate =
    newLeads > 0 ? Math.round((jobsWon / newLeads) * 10000) : null;
  const aiHandledPercent =
    totalMessages > 0
      ? Math.round(
          (aiResponses / (Number(aggregated?.outboundMessages) || 1)) * 100
        )
      : null;
  const escalationRate =
    totalMessages > 0 ? Math.round((escalations / totalMessages) * 100) : null;
  const avgJobValue = jobsWon > 0 ? Math.round(revenue / jobsWon) : null;

  // Get API costs from usage tracking
  const [usageCosts] = await db
    .select()
    .from(apiUsageMonthly)
    .where(
      and(eq(apiUsageMonthly.clientId, clientId), eq(apiUsageMonthly.month, month))
    )
    .limit(1);

  const platformCost = usageCosts?.totalCostCents || 0;
  const roiMultiple = platformCost > 0 ? revenue / platformCost : null;

  // Get previous month for comparison
  const prevMonthDate = new Date(
    parseInt(month.split('-')[0]),
    parseInt(month.split('-')[1]) - 2,
    1
  );
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const [prev] = await db
    .select()
    .from(analyticsMonthly)
    .where(
      and(
        eq(analyticsMonthly.clientId, clientId),
        eq(analyticsMonthly.month, prevMonth)
      )
    )
    .limit(1);

  const revenueChangePct = prev?.revenueAttributedCents
    ? Math.round(
        ((revenue - prev.revenueAttributedCents) /
          prev.revenueAttributedCents) *
          100
      )
    : null;
  const leadsChangePct = prev?.newLeads
    ? Math.round(((newLeads - prev.newLeads) / prev.newLeads) * 100)
    : null;

  const values = {
    clientId,
    month,
    newLeads,
    qualifiedLeads: 0, // Would need separate query
    appointmentsBooked: Number(aggregated?.appointmentsBooked) || 0,
    quotesGenerated: Number(aggregated?.quotesSent) || 0,
    jobsWon,
    jobsLost: Number(aggregated?.jobsLost) || 0,
    revenueAttributedCents: revenue,
    avgJobValueCents: avgJobValue,
    paymentsCollectedCents: Number(aggregated?.paymentsCollectedCents) || 0,
    totalMessages,
    aiHandledPercent,
    escalationRate,
    reviewsReceived: Number(aggregated?.reviewsReceived) || 0,
    leadToJobRate,
    platformCostCents: platformCost,
    roiMultiple,
    previousMonthRevenueChangePct: revenueChangePct,
    previousMonthLeadsChangePct: leadsChangePct,
  };

  // Upsert monthly analytics
  await db
    .insert(analyticsMonthly)
    .values(values)
    .onConflictDoUpdate({
      target: [analyticsMonthly.clientId, analyticsMonthly.month],
      set: { ...values },
    });
}

/**
 * Calculate platform-wide analytics
 */
export async function calculatePlatformAnalytics(
  date: string
): Promise<void> {
  const db = getDb();

  // Count clients
  const [clientCounts] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${clients.status} = 'active')`,
    })
    .from(clients);

  // New clients today
  const [newClients] = await db
    .select({ count: count() })
    .from(clients)
    .where(
      and(
        gte(clients.createdAt, new Date(`${date}T00:00:00Z`)),
        lte(clients.createdAt, new Date(`${date}T23:59:59Z`))
      )
    );

  // Aggregate usage across all clients for today
  const [totalUsage] = await db
    .select({
      leads: sum(analyticsDaily.newLeads),
      messages: sql<number>`sum(${analyticsDaily.inboundMessages} + ${analyticsDaily.outboundMessages})`,
      aiResponses: sum(analyticsDaily.aiResponses),
      escalations: sum(analyticsDaily.escalations),
    })
    .from(analyticsDaily)
    .where(eq(analyticsDaily.date, date));

  // Get total API costs for current month
  const currentMonth = date.substring(0, 7);
  const [apiCosts] = await db
    .select({
      total: sum(apiUsageMonthly.totalCostCents),
    })
    .from(apiUsageMonthly)
    .where(eq(apiUsageMonthly.month, currentMonth));

  const totalApiCosts = Number(apiCosts?.total) || 0;
  const activeClients = Number(clientCounts?.active) || 1;

  const values = {
    date,
    totalClients: Number(clientCounts?.total) || 0,
    activeClients,
    newClients: Number(newClients?.count) || 0,
    churnedClients: 0, // TODO: Calculate from subscription events
    mrrCents: 0, // TODO: Calculate from subscriptions table
    newMrrCents: 0,
    churnedMrrCents: 0,
    expansionMrrCents: 0,
    totalLeads: Number(totalUsage?.leads) || 0,
    totalMessages: Number(totalUsage?.messages) || 0,
    totalAiResponses: Number(totalUsage?.aiResponses) || 0,
    totalEscalations: Number(totalUsage?.escalations) || 0,
    totalApiCostsCents: totalApiCosts,
    avgCostPerClientCents: Math.round(totalApiCosts / activeClients),
  };

  await db
    .insert(platformAnalytics)
    .values(values)
    .onConflictDoUpdate({
      target: platformAnalytics.date,
      set: { ...values },
    });
}

/**
 * Run all analytics calculations for yesterday
 */
export async function runDailyAnalyticsJob(): Promise<void> {
  const db = getDb();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Get all active clients
  const activeClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.status, 'active'));

  // Calculate daily analytics for each client
  for (const client of activeClients) {
    try {
      await calculateDailyAnalytics(client.id, dateStr);
    } catch (error) {
      console.error(
        `[Analytics] Error calculating daily analytics for ${client.id}:`,
        error
      );
    }
  }

  // Calculate platform analytics
  await calculatePlatformAnalytics(dateStr);

  // If it's Monday, calculate weekly analytics for last week
  if (yesterday.getDay() === 0) {
    // Sunday = end of week
    const monday = new Date(yesterday);
    monday.setDate(monday.getDate() - 6);
    const weekStart = monday.toISOString().split('T')[0];

    for (const client of activeClients) {
      try {
        await calculateWeeklyAnalytics(client.id, weekStart);
      } catch (error) {
        console.error(
          `[Analytics] Error calculating weekly analytics for ${client.id}:`,
          error
        );
      }
    }
  }

  // If it's the 1st, calculate monthly analytics for last month
  if (new Date().getDate() === 1) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    for (const client of activeClients) {
      try {
        await calculateMonthlyAnalytics(client.id, monthStr);
      } catch (error) {
        console.error(
          `[Analytics] Error calculating monthly analytics for ${client.id}:`,
          error
        );
      }
    }
  }

  console.log(
    `[Analytics] Daily job complete: ${activeClients.length} clients processed for ${dateStr}`
  );
}
