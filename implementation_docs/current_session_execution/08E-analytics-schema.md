# Phase 39: Analytics Schema

## Prerequisites
- Phase 15 (Usage Tracking) complete
- Phase 28 (Revenue Attribution) complete
- Phase 29 (Lead Scoring) complete

## Goal
Create the database schema and aggregation services to support:
1. Client-facing ROI dashboard (leads, conversions, revenue)
2. Admin platform analytics (MRR, churn, health)
3. Performance metrics (response times, conversion rates)
4. Exportable reports

---

## Step 1: Create Analytics Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// ANALYTICS
// ============================================

// Daily metrics per client (granular)
export const analyticsDaily = pgTable('analytics_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  
  // Lead metrics
  newLeads: integer('new_leads').default(0).notNull(),
  leadsFromMissedCalls: integer('leads_from_missed_calls').default(0).notNull(),
  leadsFromWebForms: integer('leads_from_web_forms').default(0).notNull(),
  leadsFromReferrals: integer('leads_from_referrals').default(0).notNull(),
  leadsFromOther: integer('leads_from_other').default(0).notNull(),
  
  // Conversation metrics
  totalConversations: integer('total_conversations').default(0).notNull(),
  aiResponses: integer('ai_responses').default(0).notNull(),
  humanResponses: integer('human_responses').default(0).notNull(),
  escalations: integer('escalations').default(0).notNull(),
  avgResponseTimeSeconds: integer('avg_response_time_seconds'),
  
  // Message metrics
  inboundMessages: integer('inbound_messages').default(0).notNull(),
  outboundMessages: integer('outbound_messages').default(0).notNull(),
  
  // Conversion metrics
  appointmentsBooked: integer('appointments_booked').default(0).notNull(),
  quotesRequested: integer('quotes_requested').default(0).notNull(),
  quotesSent: integer('quotes_sent').default(0).notNull(),
  jobsWon: integer('jobs_won').default(0).notNull(),
  jobsLost: integer('jobs_lost').default(0).notNull(),
  
  // Revenue metrics (cents)
  revenueAttributedCents: integer('revenue_attributed_cents').default(0).notNull(),
  invoicesSentCents: integer('invoices_sent_cents').default(0).notNull(),
  paymentsCollectedCents: integer('payments_collected_cents').default(0).notNull(),
  
  // Review metrics
  reviewRequestsSent: integer('review_requests_sent').default(0).notNull(),
  reviewsReceived: integer('reviews_received').default(0).notNull(),
  avgRating: real('avg_rating'), // 1.0 - 5.0
  
  // Lead stage distribution (snapshot at end of day)
  leadsNew: integer('leads_new').default(0),
  leadsQualifying: integer('leads_qualifying').default(0),
  leadsNurturing: integer('leads_nurturing').default(0),
  leadsHot: integer('leads_hot').default(0),
  leadsBooked: integer('leads_booked').default(0),
  leadsLost: integer('leads_lost').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('analytics_daily_unique_idx').on(table.clientId, table.date),
  dateIdx: index('analytics_daily_date_idx').on(table.date),
}));

// Weekly aggregates
export const analyticsWeekly = pgTable('analytics_weekly', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  weekStart: date('week_start').notNull(), // Monday of the week
  
  // Aggregated from daily
  newLeads: integer('new_leads').default(0).notNull(),
  totalConversations: integer('total_conversations').default(0).notNull(),
  appointmentsBooked: integer('appointments_booked').default(0).notNull(),
  jobsWon: integer('jobs_won').default(0).notNull(),
  revenueAttributedCents: integer('revenue_attributed_cents').default(0).notNull(),
  paymentsCollectedCents: integer('payments_collected_cents').default(0).notNull(),
  
  // Conversion rates (percentage * 100 for precision)
  leadToAppointmentRate: integer('lead_to_appointment_rate'), // e.g., 2500 = 25.00%
  appointmentToJobRate: integer('appointment_to_job_rate'),
  overallConversionRate: integer('overall_conversion_rate'),
  
  // Response metrics
  avgResponseTimeSeconds: integer('avg_response_time_seconds'),
  responseWithinFiveMin: integer('response_within_five_min'), // percentage
  
  // Week-over-week changes
  leadsChangePercent: integer('leads_change_percent'),
  revenueChangePercent: integer('revenue_change_percent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('analytics_weekly_unique_idx').on(table.clientId, table.weekStart),
}));

// Monthly aggregates
export const analyticsMonthly = pgTable('analytics_monthly', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  month: varchar('month', { length: 7 }).notNull(), // "2026-02"
  
  // Lead funnel
  newLeads: integer('new_leads').default(0).notNull(),
  qualifiedLeads: integer('qualified_leads').default(0).notNull(),
  appointmentsBooked: integer('appointments_booked').default(0).notNull(),
  quotesGenerated: integer('quotes_generated').default(0).notNull(),
  jobsWon: integer('jobs_won').default(0).notNull(),
  jobsLost: integer('jobs_lost').default(0).notNull(),
  
  // Revenue
  revenueAttributedCents: integer('revenue_attributed_cents').default(0).notNull(),
  avgJobValueCents: integer('avg_job_value_cents'),
  paymentsCollectedCents: integer('payments_collected_cents').default(0).notNull(),
  outstandingInvoicesCents: integer('outstanding_invoices_cents').default(0),
  
  // Engagement
  totalMessages: integer('total_messages').default(0).notNull(),
  aiHandledPercent: integer('ai_handled_percent'), // percentage
  escalationRate: integer('escalation_rate'), // percentage
  
  // Reputation
  reviewsReceived: integer('reviews_received').default(0).notNull(),
  avgRating: real('avg_rating'),
  fiveStarReviews: integer('five_star_reviews').default(0),
  
  // Conversion rates
  leadToJobRate: integer('lead_to_job_rate'), // percentage * 100
  
  // Costs and ROI (from usage tracking)
  platformCostCents: integer('platform_cost_cents').default(0),
  roiMultiple: real('roi_multiple'), // revenue / cost
  
  // Comparison
  previousMonthRevenueChangePct: integer('previous_month_revenue_change_pct'),
  previousMonthLeadsChangePct: integer('previous_month_leads_change_pct'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('analytics_monthly_unique_idx').on(table.clientId, table.month),
  monthIdx: index('analytics_monthly_month_idx').on(table.month),
}));

// Platform-wide admin analytics
export const platformAnalytics = pgTable('platform_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull().unique(),
  
  // Client metrics
  totalClients: integer('total_clients').default(0).notNull(),
  activeClients: integer('active_clients').default(0).notNull(),
  newClients: integer('new_clients').default(0).notNull(),
  churnedClients: integer('churned_clients').default(0).notNull(),
  
  // Revenue metrics (cents)
  mrrCents: integer('mrr_cents').default(0).notNull(),
  newMrrCents: integer('new_mrr_cents').default(0).notNull(),
  churnedMrrCents: integer('churned_mrr_cents').default(0).notNull(),
  expansionMrrCents: integer('expansion_mrr_cents').default(0).notNull(),
  
  // Usage metrics
  totalLeads: integer('total_leads').default(0).notNull(),
  totalMessages: integer('total_messages').default(0).notNull(),
  totalAiResponses: integer('total_ai_responses').default(0).notNull(),
  totalEscalations: integer('total_escalations').default(0).notNull(),
  
  // Cost metrics (cents)
  totalApiCostsCents: integer('total_api_costs_cents').default(0).notNull(),
  avgCostPerClientCents: integer('avg_cost_per_client_cents'),
  
  // Health metrics
  avgClientSatisfaction: real('avg_client_satisfaction'), // 1-5 or NPS
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  dateIdx: index('platform_analytics_date_idx').on(table.date),
}));

// Funnel analytics (for detailed conversion tracking)
export const funnelEvents = pgTable('funnel_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // Event types: 'lead_created', 'first_response', 'qualified', 'appointment_booked',
  // 'quote_sent', 'quote_accepted', 'job_won', 'job_lost', 'payment_received', 'review_requested', 'review_received'
  
  eventData: jsonb('event_data').$type<Record<string, any>>(),
  valueCents: integer('value_cents'), // Associated value if any
  
  // Attribution
  source: varchar('source', { length: 50 }), // 'missed_call', 'web_form', 'referral'
  campaign: varchar('campaign', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('funnel_events_client_idx').on(table.clientId),
  leadIdx: index('funnel_events_lead_idx').on(table.leadId),
  eventTypeIdx: index('funnel_events_type_idx').on(table.eventType),
  createdAtIdx: index('funnel_events_created_idx').on(table.createdAt),
}));

// Cohort tracking for retention analysis
export const clientCohorts = pgTable('client_cohorts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull().unique(),
  cohortMonth: varchar('cohort_month', { length: 7 }).notNull(), // Month they signed up
  
  // Monthly retention tracking (months since signup)
  month1Active: boolean('month_1_active'),
  month2Active: boolean('month_2_active'),
  month3Active: boolean('month_3_active'),
  month6Active: boolean('month_6_active'),
  month12Active: boolean('month_12_active'),
  
  // Revenue over time
  month1RevenueCents: integer('month_1_revenue_cents'),
  month3RevenueCents: integer('month_3_revenue_cents'),
  month6RevenueCents: integer('month_6_revenue_cents'),
  month12RevenueCents: integer('month_12_revenue_cents'),
  lifetimeRevenueCents: integer('lifetime_revenue_cents').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  cohortIdx: index('client_cohorts_cohort_idx').on(table.cohortMonth),
}));
```

---

## Step 2: Create Analytics Aggregation Service

**CREATE** `src/lib/services/analytics-aggregation.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  analyticsDaily, 
  analyticsWeekly, 
  analyticsMonthly,
  platformAnalytics,
  funnelEvents,
  leads,
  messages,
  clients,
  escalationQueue,
  apiUsageMonthly,
  leadContext,
} from '@/lib/db/schema';
import { eq, and, gte, lte, sql, count, sum, avg, desc } from 'drizzle-orm';

/**
 * Calculate daily analytics for a client
 */
export async function calculateDailyAnalytics(
  clientId: string, 
  date: string
): Promise<void> {
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);
  
  // Count new leads
  const [leadCounts] = await db
    .select({
      total: count(),
      missedCalls: sql<number>`count(*) filter (where source = 'missed_call')`,
      webForms: sql<number>`count(*) filter (where source = 'web_form')`,
      referrals: sql<number>`count(*) filter (where source = 'referral')`,
    })
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      gte(leads.createdAt, startOfDay),
      lte(leads.createdAt, endOfDay)
    ));
  
  // Count messages
  const [messageCounts] = await db
    .select({
      inbound: sql<number>`count(*) filter (where direction = 'inbound')`,
      outbound: sql<number>`count(*) filter (where direction = 'outbound')`,
      aiResponses: sql<number>`count(*) filter (where direction = 'outbound' and sender_type = 'ai')`,
      humanResponses: sql<number>`count(*) filter (where direction = 'outbound' and sender_type = 'human')`,
    })
    .from(messages)
    .where(and(
      eq(messages.clientId, clientId),
      gte(messages.createdAt, startOfDay),
      lte(messages.createdAt, endOfDay)
    ));
  
  // Count escalations
  const [escalationCount] = await db
    .select({ count: count() })
    .from(escalationQueue)
    .where(and(
      eq(escalationQueue.clientId, clientId),
      gte(escalationQueue.createdAt, startOfDay),
      lte(escalationQueue.createdAt, endOfDay)
    ));
  
  // Count funnel events
  const funnelCounts = await db
    .select({
      eventType: funnelEvents.eventType,
      count: count(),
      totalValue: sum(funnelEvents.valueCents),
    })
    .from(funnelEvents)
    .where(and(
      eq(funnelEvents.clientId, clientId),
      gte(funnelEvents.createdAt, startOfDay),
      lte(funnelEvents.createdAt, endOfDay)
    ))
    .groupBy(funnelEvents.eventType);
  
  const eventMap = Object.fromEntries(
    funnelCounts.map(e => [e.eventType, { count: Number(e.count), value: Number(e.totalValue) || 0 }])
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
    stageCounts.map(s => [s.stage, Number(s.count)])
  );
  
  // Calculate average response time
  // (This would need a more complex query looking at message pairs)
  const avgResponseTime = await calculateAvgResponseTime(clientId, startOfDay, endOfDay);
  
  // Upsert daily analytics
  await db
    .insert(analyticsDaily)
    .values({
      clientId,
      date,
      newLeads: Number(leadCounts?.total) || 0,
      leadsFromMissedCalls: Number(leadCounts?.missedCalls) || 0,
      leadsFromWebForms: Number(leadCounts?.webForms) || 0,
      leadsFromReferrals: Number(leadCounts?.referrals) || 0,
      leadsFromOther: (Number(leadCounts?.total) || 0) - 
        (Number(leadCounts?.missedCalls) || 0) - 
        (Number(leadCounts?.webForms) || 0) - 
        (Number(leadCounts?.referrals) || 0),
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
    })
    .onConflictDoUpdate({
      target: [analyticsDaily.clientId, analyticsDaily.date],
      set: {
        newLeads: Number(leadCounts?.total) || 0,
        // ... all other fields
        updatedAt: new Date(),
      },
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
  // Get inbound messages with their next outbound response
  const result = await db.execute(sql`
    WITH message_pairs AS (
      SELECT 
        m1.id as inbound_id,
        m1.created_at as inbound_time,
        MIN(m2.created_at) as response_time
      FROM messages m1
      LEFT JOIN messages m2 ON 
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
  
  return result.rows[0]?.avg_seconds ? Math.round(Number(result.rows[0].avg_seconds)) : null;
}

/**
 * Calculate weekly analytics from daily data
 */
export async function calculateWeeklyAnalytics(
  clientId: string,
  weekStart: string // Monday date
): Promise<void> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  
  // Aggregate daily data
  const [aggregated] = await db
    .select({
      newLeads: sum(analyticsDaily.newLeads),
      totalConversations: sql<number>`count(distinct lead_id)`, // Would need adjustment
      appointmentsBooked: sum(analyticsDaily.appointmentsBooked),
      jobsWon: sum(analyticsDaily.jobsWon),
      revenueAttributedCents: sum(analyticsDaily.revenueAttributedCents),
      paymentsCollectedCents: sum(analyticsDaily.paymentsCollectedCents),
      avgResponseTimeSeconds: avg(analyticsDaily.avgResponseTimeSeconds),
    })
    .from(analyticsDaily)
    .where(and(
      eq(analyticsDaily.clientId, clientId),
      gte(analyticsDaily.date, weekStart),
      lte(analyticsDaily.date, weekEndStr)
    ));
  
  // Calculate conversion rates
  const newLeads = Number(aggregated?.newLeads) || 0;
  const appointments = Number(aggregated?.appointmentsBooked) || 0;
  const jobsWon = Number(aggregated?.jobsWon) || 0;
  
  const leadToAppointmentRate = newLeads > 0 
    ? Math.round((appointments / newLeads) * 10000) 
    : null;
  const appointmentToJobRate = appointments > 0 
    ? Math.round((jobsWon / appointments) * 10000) 
    : null;
  const overallConversionRate = newLeads > 0 
    ? Math.round((jobsWon / newLeads) * 10000) 
    : null;
  
  // Get previous week for comparison
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];
  
  const [prevWeek] = await db
    .select()
    .from(analyticsWeekly)
    .where(and(
      eq(analyticsWeekly.clientId, clientId),
      eq(analyticsWeekly.weekStart, prevWeekStartStr)
    ))
    .limit(1);
  
  const leadsChangePercent = prevWeek?.newLeads 
    ? Math.round(((newLeads - prevWeek.newLeads) / prevWeek.newLeads) * 100)
    : null;
  
  const currentRevenue = Number(aggregated?.revenueAttributedCents) || 0;
  const revenueChangePercent = prevWeek?.revenueAttributedCents
    ? Math.round(((currentRevenue - prevWeek.revenueAttributedCents) / prevWeek.revenueAttributedCents) * 100)
    : null;
  
  // Upsert weekly analytics
  await db
    .insert(analyticsWeekly)
    .values({
      clientId,
      weekStart,
      newLeads,
      totalConversations: 0, // Would need proper calculation
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
    })
    .onConflictDoUpdate({
      target: [analyticsWeekly.clientId, analyticsWeekly.weekStart],
      set: {
        newLeads,
        appointmentsBooked: appointments,
        jobsWon,
        revenueAttributedCents: currentRevenue,
        leadToAppointmentRate,
        overallConversionRate,
      },
    });
}

/**
 * Calculate monthly analytics
 */
export async function calculateMonthlyAnalytics(
  clientId: string,
  month: string // "2026-02"
): Promise<void> {
  const startDate = `${month}-01`;
  const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
    .toISOString().split('T')[0];
  
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
    .where(and(
      eq(analyticsDaily.clientId, clientId),
      gte(analyticsDaily.date, startDate),
      lte(analyticsDaily.date, endDate)
    ));
  
  const newLeads = Number(aggregated?.newLeads) || 0;
  const jobsWon = Number(aggregated?.jobsWon) || 0;
  const revenue = Number(aggregated?.revenueAttributedCents) || 0;
  const totalMessages = (Number(aggregated?.inboundMessages) || 0) + (Number(aggregated?.outboundMessages) || 0);
  const aiResponses = Number(aggregated?.aiResponses) || 0;
  const escalations = Number(aggregated?.escalations) || 0;
  
  // Calculate rates
  const leadToJobRate = newLeads > 0 ? Math.round((jobsWon / newLeads) * 10000) : null;
  const aiHandledPercent = totalMessages > 0 
    ? Math.round((aiResponses / (Number(aggregated?.outboundMessages) || 1)) * 100) 
    : null;
  const escalationRate = totalMessages > 0 
    ? Math.round((escalations / totalMessages) * 100) 
    : null;
  const avgJobValue = jobsWon > 0 ? Math.round(revenue / jobsWon) : null;
  
  // Get API costs from usage tracking
  const [usageCosts] = await db
    .select()
    .from(apiUsageMonthly)
    .where(and(
      eq(apiUsageMonthly.clientId, clientId),
      eq(apiUsageMonthly.month, month)
    ))
    .limit(1);
  
  const platformCost = usageCosts?.totalCostCents || 0;
  const roiMultiple = platformCost > 0 ? revenue / platformCost : null;
  
  // Get previous month for comparison
  const prevMonthDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 2, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [prev] = await db
    .select()
    .from(analyticsMonthly)
    .where(and(
      eq(analyticsMonthly.clientId, clientId),
      eq(analyticsMonthly.month, prevMonth)
    ))
    .limit(1);
  
  const revenueChangePct = prev?.revenueAttributedCents
    ? Math.round(((revenue - prev.revenueAttributedCents) / prev.revenueAttributedCents) * 100)
    : null;
  const leadsChangePct = prev?.newLeads
    ? Math.round(((newLeads - prev.newLeads) / prev.newLeads) * 100)
    : null;
  
  // Upsert monthly analytics
  await db
    .insert(analyticsMonthly)
    .values({
      clientId,
      month,
      newLeads,
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
    })
    .onConflictDoUpdate({
      target: [analyticsMonthly.clientId, analyticsMonthly.month],
      set: {
        newLeads,
        jobsWon,
        revenueAttributedCents: revenue,
        platformCostCents: platformCost,
        roiMultiple,
      },
    });
}

/**
 * Calculate platform-wide analytics
 */
export async function calculatePlatformAnalytics(date: string): Promise<void> {
  // Count clients
  const [clientCounts] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where status = 'active')`,
    })
    .from(clients);
  
  // New clients today
  const [newClients] = await db
    .select({ count: count() })
    .from(clients)
    .where(and(
      gte(clients.createdAt, new Date(`${date}T00:00:00Z`)),
      lte(clients.createdAt, new Date(`${date}T23:59:59Z`))
    ));
  
  // TODO: Calculate MRR from subscriptions table
  // TODO: Calculate churn
  
  // Aggregate usage across all clients
  const [totalUsage] = await db
    .select({
      leads: sum(analyticsDaily.newLeads),
      messages: sql<number>`sum(inbound_messages + outbound_messages)`,
      aiResponses: sum(analyticsDaily.aiResponses),
      escalations: sum(analyticsDaily.escalations),
    })
    .from(analyticsDaily)
    .where(eq(analyticsDaily.date, date));
  
  // Get total API costs
  const currentMonth = date.substring(0, 7);
  const [apiCosts] = await db
    .select({
      total: sum(apiUsageMonthly.totalCostCents),
    })
    .from(apiUsageMonthly)
    .where(eq(apiUsageMonthly.month, currentMonth));
  
  const totalApiCosts = Number(apiCosts?.total) || 0;
  const activeClients = Number(clientCounts?.active) || 1;
  
  await db
    .insert(platformAnalytics)
    .values({
      date,
      totalClients: Number(clientCounts?.total) || 0,
      activeClients,
      newClients: Number(newClients?.count) || 0,
      totalLeads: Number(totalUsage?.leads) || 0,
      totalMessages: Number(totalUsage?.messages) || 0,
      totalAiResponses: Number(totalUsage?.aiResponses) || 0,
      totalEscalations: Number(totalUsage?.escalations) || 0,
      totalApiCostsCents: totalApiCosts,
      avgCostPerClientCents: Math.round(totalApiCosts / activeClients),
    })
    .onConflictDoUpdate({
      target: platformAnalytics.date,
      set: {
        totalClients: Number(clientCounts?.total) || 0,
        activeClients,
        totalLeads: Number(totalUsage?.leads) || 0,
      },
    });
}

/**
 * Run all analytics calculations for yesterday
 */
export async function runDailyAnalyticsJob(): Promise<void> {
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
      console.error(`Error calculating daily analytics for ${client.id}:`, error);
    }
  }
  
  // Calculate platform analytics
  await calculatePlatformAnalytics(dateStr);
  
  // If it's Monday, calculate weekly analytics for last week
  if (yesterday.getDay() === 0) { // Sunday = end of week
    const monday = new Date(yesterday);
    monday.setDate(monday.getDate() - 6);
    const weekStart = monday.toISOString().split('T')[0];
    
    for (const client of activeClients) {
      try {
        await calculateWeeklyAnalytics(client.id, weekStart);
      } catch (error) {
        console.error(`Error calculating weekly analytics for ${client.id}:`, error);
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
        console.error(`Error calculating monthly analytics for ${client.id}:`, error);
      }
    }
  }
}
```

---

## Step 3: Create Funnel Event Tracking Service

**CREATE** `src/lib/services/funnel-tracking.ts`:

```typescript
import { db } from '@/lib/db';
import { funnelEvents } from '@/lib/db/schema';

export type FunnelEventType = 
  | 'lead_created'
  | 'first_response'
  | 'qualified'
  | 'appointment_booked'
  | 'quote_requested'
  | 'quote_sent'
  | 'quote_accepted'
  | 'job_won'
  | 'job_lost'
  | 'payment_received'
  | 'review_requested'
  | 'review_received';

interface TrackFunnelEventParams {
  clientId: string;
  leadId: string;
  eventType: FunnelEventType;
  valueCents?: number;
  source?: string;
  campaign?: string;
  eventData?: Record<string, any>;
}

/**
 * Track a funnel event
 */
export async function trackFunnelEvent(params: TrackFunnelEventParams): Promise<void> {
  await db.insert(funnelEvents).values({
    clientId: params.clientId,
    leadId: params.leadId,
    eventType: params.eventType,
    valueCents: params.valueCents,
    source: params.source,
    campaign: params.campaign,
    eventData: params.eventData,
  });
}

/**
 * Helper functions for common events
 */
export const trackLeadCreated = (clientId: string, leadId: string, source?: string) =>
  trackFunnelEvent({ clientId, leadId, eventType: 'lead_created', source });

export const trackFirstResponse = (clientId: string, leadId: string, responseTimeSeconds: number) =>
  trackFunnelEvent({ 
    clientId, 
    leadId, 
    eventType: 'first_response',
    eventData: { responseTimeSeconds },
  });

export const trackAppointmentBooked = (clientId: string, leadId: string, appointmentDate?: string) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'appointment_booked',
    eventData: { appointmentDate },
  });

export const trackJobWon = (clientId: string, leadId: string, valueCents: number) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'job_won',
    valueCents,
  });

export const trackPaymentReceived = (clientId: string, leadId: string, amountCents: number) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'payment_received',
    valueCents: amountCents,
  });

export const trackReviewReceived = (clientId: string, leadId: string, rating: number, platform: string) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'review_received',
    eventData: { rating, platform },
  });
```

---

## Step 4: Create Analytics Query Service

**CREATE** `src/lib/services/analytics-queries.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  analyticsDaily, 
  analyticsWeekly, 
  analyticsMonthly,
  funnelEvents,
} from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * Get dashboard summary for a client
 */
export async function getClientDashboardSummary(clientId: string) {
  // Get current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Get this month's data
  const [monthly] = await db
    .select()
    .from(analyticsMonthly)
    .where(and(
      eq(analyticsMonthly.clientId, clientId),
      eq(analyticsMonthly.month, currentMonth)
    ))
    .limit(1);
  
  // Get last 7 days for trend
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const dailyTrend = await db
    .select()
    .from(analyticsDaily)
    .where(and(
      eq(analyticsDaily.clientId, clientId),
      gte(analyticsDaily.date, sevenDaysAgo.toISOString().split('T')[0])
    ))
    .orderBy(analyticsDaily.date);
  
  return {
    monthly,
    dailyTrend,
    currentMonth,
  };
}

/**
 * Get conversion funnel data
 */
export async function getConversionFunnel(
  clientId: string,
  startDate: string,
  endDate: string
) {
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
      count: sql<number>`count(distinct lead_id)`,
      totalValue: sql<number>`sum(value_cents)`,
    })
    .from(funnelEvents)
    .where(and(
      eq(funnelEvents.clientId, clientId),
      gte(funnelEvents.createdAt, new Date(startDate)),
      lte(funnelEvents.createdAt, new Date(endDate)),
      sql`event_type = ANY(${funnelStages})`
    ))
    .groupBy(funnelEvents.eventType);
  
  const countMap = Object.fromEntries(
    counts.map(c => [c.eventType, { count: Number(c.count), value: Number(c.totalValue) || 0 }])
  );
  
  return funnelStages.map((stage, index) => {
    const current = countMap[stage]?.count || 0;
    const previous = index > 0 ? (countMap[funnelStages[index - 1]]?.count || 0) : current;
    const conversionRate = previous > 0 ? Math.round((current / previous) * 100) : 0;
    
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
 */
export async function getLeadSourceBreakdown(
  clientId: string,
  startDate: string,
  endDate: string
) {
  return db
    .select({
      source: funnelEvents.source,
      leads: sql<number>`count(distinct lead_id)`,
      conversions: sql<number>`count(distinct lead_id) filter (where event_type = 'job_won')`,
      revenue: sql<number>`sum(value_cents) filter (where event_type = 'job_won')`,
    })
    .from(funnelEvents)
    .where(and(
      eq(funnelEvents.clientId, clientId),
      gte(funnelEvents.createdAt, new Date(startDate)),
      lte(funnelEvents.createdAt, new Date(endDate))
    ))
    .groupBy(funnelEvents.source);
}

/**
 * Get response time distribution
 */
export async function getResponseTimeDistribution(
  clientId: string,
  startDate: string,
  endDate: string
) {
  const distribution = await db
    .select({
      bucket: sql<string>`
        CASE 
          WHEN avg_response_time_seconds <= 60 THEN 'Under 1 min'
          WHEN avg_response_time_seconds <= 300 THEN '1-5 min'
          WHEN avg_response_time_seconds <= 900 THEN '5-15 min'
          WHEN avg_response_time_seconds <= 3600 THEN '15-60 min'
          ELSE 'Over 1 hour'
        END
      `,
      count: count(),
    })
    .from(analyticsDaily)
    .where(and(
      eq(analyticsDaily.clientId, clientId),
      gte(analyticsDaily.date, startDate),
      lte(analyticsDaily.date, endDate),
      sql`avg_response_time_seconds IS NOT NULL`
    ))
    .groupBy(sql`1`);
  
  return distribution;
}

/**
 * Get month-over-month comparison
 */
export async function getMonthlyComparison(clientId: string, months: number = 6) {
  const data = await db
    .select()
    .from(analyticsMonthly)
    .where(eq(analyticsMonthly.clientId, clientId))
    .orderBy(desc(analyticsMonthly.month))
    .limit(months);
  
  return data.reverse();
}
```

---

## Step 5: Add Cron Job

**MODIFY** `src/app/api/cron/daily/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { runDailyAnalyticsJob } from '@/lib/services/analytics-aggregation';

export async function GET() {
  await runDailyAnalyticsJob();
  
  return NextResponse.json({ success: true });
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add analytics tables |
| `src/lib/services/analytics-aggregation.ts` | Created |
| `src/lib/services/funnel-tracking.ts` | Created |
| `src/lib/services/analytics-queries.ts` | Created |
| `src/app/api/cron/daily/route.ts` | Modified |

---

## Database Tables Created

| Table | Purpose |
|-------|---------|
| `analytics_daily` | Daily metrics per client |
| `analytics_weekly` | Weekly aggregates with WoW comparison |
| `analytics_monthly` | Monthly summary with MoM comparison |
| `platform_analytics` | Platform-wide admin metrics |
| `funnel_events` | Granular conversion tracking |
| `client_cohorts` | Retention cohort analysis |

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Manually trigger analytics calculation
curl http://localhost:3000/api/cron/daily

# 3. Check analytics tables
SELECT * FROM analytics_daily WHERE date = CURRENT_DATE - 1;
SELECT * FROM analytics_monthly WHERE month = '2026-02';

# 4. Verify funnel events
SELECT event_type, count(*) FROM funnel_events GROUP BY event_type;
```

---

## Success Criteria
- [ ] Daily analytics calculating for all clients
- [ ] Weekly aggregates with conversion rates
- [ ] Monthly summaries with MoM comparison
- [ ] Platform-wide metrics updating
- [ ] Funnel events tracking across lead journey
- [ ] Response time distribution calculating
- [ ] ROI calculation based on revenue vs platform cost
