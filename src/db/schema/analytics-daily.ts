import {
  pgTable,
  uuid,
  date,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

// Daily metrics per client (granular)
export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
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
  },
  (table) => [
    uniqueIndex('analytics_daily_unique_idx').on(table.clientId, table.date),
    index('analytics_daily_date_idx').on(table.date),
  ]
);

export type AnalyticsDaily = typeof analyticsDaily.$inferSelect;
export type NewAnalyticsDaily = typeof analyticsDaily.$inferInsert;
