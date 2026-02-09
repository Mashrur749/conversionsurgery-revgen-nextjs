import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { jobs } from './jobs';
import { clients } from './clients';

export const revenueEvents = pgTable('revenue_events', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  amount: integer('amount'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type RevenueEvent = typeof revenueEvents.$inferSelect;
export type NewRevenueEvent = typeof revenueEvents.$inferInsert;
