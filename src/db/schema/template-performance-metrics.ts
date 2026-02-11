import {
  pgTable,
  uuid,
  date,
  integer,
  decimal,
  timestamp,
  index,
  varchar,
} from 'drizzle-orm/pg-core';
import { templateVariants } from './template-variants';

/**
 * Aggregate performance metrics for template variants
 * Tracks metrics across all clients using a specific template variant
 * Updated daily via aggregation job
 */
export const templatePerformanceMetrics = pgTable(
  'template_performance_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateVariantId: uuid('template_variant_id')
      .notNull()
      .references(() => templateVariants.id, { onDelete: 'cascade' }),
    dateCollected: date('date_collected').notNull(), // Date these metrics were aggregated for
    period: varchar('period', { length: 10 }).notNull(), // 'daily', 'weekly', 'monthly'

    // Raw counts aggregated across all clients using this variant
    totalExecutions: integer('total_executions').default(0), // How many times was this template sent?
    totalDelivered: integer('total_delivered').default(0),
    totalConversationsStarted: integer('total_conversations_started').default(0),
    totalAppointmentsReminded: integer('total_appointments_reminded').default(0),
    totalEstimatesFollowedUp: integer('total_estimates_followed_up').default(0),
    totalFormsResponded: integer('total_forms_responded').default(0),
    totalLeadsQualified: integer('total_leads_qualified').default(0),
    totalRevenueRecovered: decimal('total_revenue_recovered', { precision: 12, scale: 2 }),

    // Calculated metrics (percentages stored as decimals, e.g., 0.34 = 34%)
    deliveryRate: decimal('delivery_rate', { precision: 5, scale: 4 }).default('0'),
    engagementRate: decimal('engagement_rate', { precision: 5, scale: 4 }).default('0'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 4 }).default('0'),
    avgResponseTime: integer('avg_response_time'), // in minutes

    // Metadata
    clientsUsingVariant: integer('clients_using_variant').default(0), // How many clients are using this variant?

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_template_perf_variant').on(table.templateVariantId),
    index('idx_template_perf_date').on(table.dateCollected),
    index('idx_template_perf_period').on(table.period),
    index('idx_template_perf_variant_date').on(table.templateVariantId, table.dateCollected),
  ]
);

export type TemplatePerformanceMetrics = typeof templatePerformanceMetrics.$inferSelect;
export type NewTemplatePerformanceMetrics = typeof templatePerformanceMetrics.$inferInsert;
