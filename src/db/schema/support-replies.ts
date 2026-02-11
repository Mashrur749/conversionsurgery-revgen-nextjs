import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { supportMessages } from './support-messages';

export const supportReplies = pgTable(
  'support_replies',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    supportMessageId: uuid('support_message_id')
      .notNull()
      .references(() => supportMessages.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAdmin: boolean('is_admin').default(false).notNull(),
    authorEmail: varchar('author_email', { length: 255 }).notNull(),
    calcomLink: varchar('calcom_link', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => []
);

export type SupportReply = typeof supportReplies.$inferSelect;
export type NewSupportReply = typeof supportReplies.$inferInsert;
