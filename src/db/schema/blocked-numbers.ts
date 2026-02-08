import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const blockedNumbers = pgTable(
  'blocked_numbers',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    phone: varchar('phone', { length: 20 }).notNull(),
    reason: varchar('reason', { length: 50 }), // opt_out, spam, manual
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    unique('blocked_numbers_client_phone_unique').on(table.clientId, table.phone),
    index('idx_blocked_numbers_phone').on(table.clientId, table.phone),
  ]
);

export type BlockedNumber = typeof blockedNumbers.$inferSelect;
export type NewBlockedNumber = typeof blockedNumbers.$inferInsert;
