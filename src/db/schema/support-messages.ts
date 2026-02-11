import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';

export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    userEmail: varchar('user_email', { length: 255 }).notNull(),
    page: varchar('page', { length: 500 }).notNull(),
    message: text('message').notNull(),
    status: varchar('status', { length: 20 }).default('open').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => []
);

export type SupportMessage = typeof supportMessages.$inferSelect;
export type NewSupportMessage = typeof supportMessages.$inferInsert;
