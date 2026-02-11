import {
  pgTable,
  uuid,
  date,
  integer,
  decimal,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { flowTemplates } from './flow-templates';

/**
 * Daily rollup of template performance across all clients
 */
export const templateMetricsDaily = pgTable(
  'template_metrics_daily',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),

    // Volume
    executionsStarted: integer('executions_started').default(0),
    executionsCompleted: integer('executions_completed').default(0),
    executionsCancelled: integer('executions_cancelled').default(0),

    // Messages
    messagesSent: integer('messages_sent').default(0),
    messagesDelivered: integer('messages_delivered').default(0),
    messagesFailed: integer('messages_failed').default(0),

    // Engagement
    leadsResponded: integer('leads_responded').default(0),
    totalResponses: integer('total_responses').default(0),
    avgResponseTimeMinutes: integer('avg_response_time_minutes'),

    // Conversions (outcome depends on category)
    conversions: integer('conversions').default(0),
    conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }),

    // Opt-outs
    optOuts: integer('opt_outs').default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('template_date_idx').on(table.templateId, table.date),
  ]
);

export type TemplateMetricsDaily = typeof templateMetricsDaily.$inferSelect;
export type NewTemplateMetricsDaily = typeof templateMetricsDaily.$inferInsert;
