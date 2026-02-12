import {
  pgTable,
  uuid,
  date,
  integer,
  real,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// Platform-wide admin analytics
export const platformAnalytics = pgTable(
  'platform_analytics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
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
  },
  (table) => [
    index('platform_analytics_date_idx').on(table.date),
  ]
);

export type PlatformAnalytics = typeof platformAnalytics.$inferSelect;
export type NewPlatformAnalytics = typeof platformAnalytics.$inferInsert;
