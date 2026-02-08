import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const activeCalls = pgTable(
  'active_calls',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    callSid: varchar('call_sid', { length: 100 }).notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    callerPhone: varchar('caller_phone', { length: 20 }).notNull(),
    twilioNumber: varchar('twilio_number', { length: 20 }).notNull(),
    receivedAt: timestamp('received_at').notNull(),
    processed: boolean('processed').default(false).notNull(), // Whether action callback already handled it
    processedAt: timestamp('processed_at'), // When it was processed by action callback
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_active_calls_call_sid').on(table.callSid),
    index('idx_active_calls_client_id').on(table.clientId),
    index('idx_active_calls_received_at').on(table.receivedAt),
    index('idx_active_calls_processed').on(table.processed),
  ]
);

export type ActiveCall = typeof activeCalls.$inferSelect;
export type NewActiveCall = typeof activeCalls.$inferInsert;
