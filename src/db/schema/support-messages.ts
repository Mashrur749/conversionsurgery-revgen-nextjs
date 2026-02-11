import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

/** Support messages table — stores user-initiated discussion threads. */
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    userEmail: varchar('user_email', { length: 255 }).notNull(),
    page: varchar('page', { length: 500 }).notNull(),
    message: text('message').notNull(),
    status: varchar('status', { length: 20 }).default('open').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => []
);

/** Inferred select type for a support message row. */
export type SupportMessage = typeof supportMessages.$inferSelect;
/** Inferred insert type for creating a new support message. */
export type NewSupportMessage = typeof supportMessages.$inferInsert;
