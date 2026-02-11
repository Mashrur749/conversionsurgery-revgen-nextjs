import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { jobs } from './jobs';
import { clients } from './clients';

export const revenueEvents = pgTable('revenue_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  amount: integer('amount'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type RevenueEvent = typeof revenueEvents.$inferSelect;
export type NewRevenueEvent = typeof revenueEvents.$inferInsert;
