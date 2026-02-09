import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

// Usage alerts
export const usageAlerts = pgTable(
  'usage_alerts',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    alertType: varchar('alert_type', { length: 30 }).notNull(), // 'spike', 'threshold', 'anomaly'
    severity: varchar('severity', { length: 10 }).notNull(), // 'info', 'warning', 'critical'

    message: text('message').notNull(),
    details: jsonb('details').$type<{
      currentCost?: number;
      previousCost?: number;
      threshold?: number;
      percentChange?: number;
      projectedCost?: number;
    }>(),

    acknowledged: boolean('acknowledged').default(false),
    acknowledgedAt: timestamp('acknowledged_at'),
    acknowledgedBy: uuid('acknowledged_by'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('usage_alerts_client_idx').on(table.clientId),
    index('usage_alerts_unack_idx').on(table.acknowledged),
  ]
);

export type UsageAlert = typeof usageAlerts.$inferSelect;
export type NewUsageAlert = typeof usageAlerts.$inferInsert;
