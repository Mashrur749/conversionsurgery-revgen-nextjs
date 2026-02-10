import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

// Monthly aggregates
export const analyticsMonthly = pgTable(
  'analytics_monthly',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
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
  },
  (table) => [
    uniqueIndex('analytics_monthly_unique_idx').on(table.clientId, table.month),
    index('analytics_monthly_month_idx').on(table.month),
  ]
);

export type AnalyticsMonthly = typeof analyticsMonthly.$inferSelect;
export type NewAnalyticsMonthly = typeof analyticsMonthly.$inferInsert;
