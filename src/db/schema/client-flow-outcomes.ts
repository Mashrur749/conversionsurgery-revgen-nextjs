import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { flows } from './flows';

// Client-level outcomes (simple, not statistical)
export const clientFlowOutcomes = pgTable(
  'client_flow_outcomes',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'set null' }),
    period: varchar('period', { length: 10 }).notNull(), // '2024-01' monthly

    // Simple outcomes
    leadsContacted: integer('leads_contacted').default(0),
    leadsResponded: integer('leads_responded').default(0),
    conversions: integer('conversions').default(0),
    revenue: decimal('revenue', { precision: 10, scale: 2 }).default('0'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    uniqueIndex('client_flow_period_idx').on(
      table.clientId,
      table.flowId,
      table.period
    ),
  ]
);

export type ClientFlowOutcome = typeof clientFlowOutcomes.$inferSelect;
export type NewClientFlowOutcome = typeof clientFlowOutcomes.$inferInsert;
