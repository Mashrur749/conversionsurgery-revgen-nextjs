import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const cancellationRequests = pgTable(
  'cancellation_requests',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).default('pending'), // pending, scheduled_call, saved, cancelled
    reason: text('reason'),
    feedback: text('feedback'),
    valueShown: jsonb('value_shown'), // Stats shown at cancellation
    scheduledCallAt: timestamp('scheduled_call_at'),
    gracePeriodEnds: timestamp('grace_period_ends'),
    createdAt: timestamp('created_at').defaultNow(),
    processedAt: timestamp('processed_at'),
    processedBy: varchar('processed_by', { length: 255 }),
  },
  (table) => [
    index('idx_cancellation_requests_client').on(table.clientId),
    index('idx_cancellation_requests_status').on(table.status),
  ]
);

export type CancellationRequest = typeof cancellationRequests.$inferSelect;
export type NewCancellationRequest = typeof cancellationRequests.$inferInsert;
