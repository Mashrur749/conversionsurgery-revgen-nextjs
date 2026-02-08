import {
  pgTable,
  uuid,
  date,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const dailyStats = pgTable(
  'daily_stats',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    missedCallsCaptured: integer('missed_calls_captured').default(0),
    formsResponded: integer('forms_responded').default(0),
    conversationsStarted: integer('conversations_started').default(0),
    appointmentsReminded: integer('appointments_reminded').default(0),
    estimatesFollowedUp: integer('estimates_followed_up').default(0),
    reviewsRequested: integer('reviews_requested').default(0),
    referralsRequested: integer('referrals_requested').default(0),
    paymentsReminded: integer('payments_reminded').default(0),
    messagesSent: integer('messages_sent').default(0),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    unique('daily_stats_client_date_unique').on(table.clientId, table.date),
    index('idx_daily_stats_client_date').on(table.clientId, table.date),
  ]
);

export type DailyStats = typeof dailyStats.$inferSelect;
export type NewDailyStats = typeof dailyStats.$inferInsert;
