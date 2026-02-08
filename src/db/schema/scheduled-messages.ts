import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';

export const scheduledMessages = pgTable(
  'scheduled_messages',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    sequenceType: varchar('sequence_type', { length: 50 }), // estimate_followup, payment_reminder, appointment_reminder, review_request, referral_request
    sequenceStep: integer('sequence_step'),
    content: text('content').notNull(),
    sendAt: timestamp('send_at').notNull(),
    sent: boolean('sent').default(false),
    sentAt: timestamp('sent_at'),
    cancelled: boolean('cancelled').default(false),
    cancelledAt: timestamp('cancelled_at'),
    cancelledReason: varchar('cancelled_reason', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_scheduled_messages_send_at').on(table.sendAt).where(
      sql`${table.sent} = false AND ${table.cancelled} = false`
    ),
    index('idx_scheduled_messages_client_id').on(table.clientId),
    index('idx_scheduled_messages_lead_id').on(table.leadId),
  ]
);

export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type NewScheduledMessage = typeof scheduledMessages.$inferInsert;
