import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { supportMessages } from './support-messages';

/** Support replies table — stores individual replies within a discussion thread. */
export const supportReplies = pgTable(
  'support_replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    supportMessageId: uuid('support_message_id')
      .notNull()
      .references(() => supportMessages.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAdmin: boolean('is_admin').default(false).notNull(),
    authorEmail: varchar('author_email', { length: 255 }).notNull(),
    calcomLink: varchar('calcom_link', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => []
);

/** Inferred select type for a support reply row. */
export type SupportReply = typeof supportReplies.$inferSelect;
/** Inferred insert type for creating a new support reply. */
export type NewSupportReply = typeof supportReplies.$inferInsert;
