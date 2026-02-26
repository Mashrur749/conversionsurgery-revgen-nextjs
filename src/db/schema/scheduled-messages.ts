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
    id: uuid('id').defaultRandom().primaryKey(),
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
    assistStatus: varchar('assist_status', { length: 40 }), // pending_approval, auto_sent, approved_sent, cancelled
    assistCategory: varchar('assist_category', { length: 40 }),
    assistRequiresManual: boolean('assist_requires_manual').default(false),
    assistOriginalContent: text('assist_original_content'),
    assistReferenceCode: varchar('assist_reference_code', { length: 12 }),
    assistNotifiedAt: timestamp('assist_notified_at'),
    assistResolvedAt: timestamp('assist_resolved_at'),
    assistResolutionSource: varchar('assist_resolution_source', { length: 40 }),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_scheduled_messages_send_at').on(table.sendAt).where(
      sql`${table.sent} = false AND ${table.cancelled} = false`
    ),
    index('idx_scheduled_messages_client_id').on(table.clientId),
    index('idx_scheduled_messages_lead_id').on(table.leadId),
    index('idx_scheduled_messages_assist_status').on(table.assistStatus, table.sendAt).where(
      sql`${table.assistStatus} = 'pending_approval' AND ${table.sent} = false AND ${table.cancelled} = false`
    ),
    index('idx_scheduled_messages_assist_reference').on(table.clientId, table.assistReferenceCode),
  ]
);

export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type NewScheduledMessage = typeof scheduledMessages.$inferInsert;
