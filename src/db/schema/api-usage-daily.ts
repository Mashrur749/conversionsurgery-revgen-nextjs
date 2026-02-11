import {
  pgTable,
  uuid,
  date,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { apiServiceEnum } from './api-usage';

// Daily aggregates (for faster reporting)
export const apiUsageDaily = pgTable(
  'api_usage_daily',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    service: apiServiceEnum('service').notNull(),

    // Aggregated metrics
    totalRequests: integer('total_requests').default(0).notNull(),
    totalTokensIn: integer('total_tokens_in').default(0).notNull(),
    totalTokensOut: integer('total_tokens_out').default(0).notNull(),
    totalUnits: integer('total_units').default(0).notNull(),
    totalCostCents: integer('total_cost_cents').default(0).notNull(),

    // Breakdown by operation (JSON for flexibility)
    operationBreakdown: jsonb('operation_breakdown').$type<Record<string, {
      requests: number;
      costCents: number;
    }>>(),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_usage_daily_unique_idx').on(table.clientId, table.date, table.service),
    index('api_usage_daily_date_idx').on(table.date),
  ]
);

export type ApiUsageDaily = typeof apiUsageDaily.$inferSelect;
export type NewApiUsageDaily = typeof apiUsageDaily.$inferInsert;
