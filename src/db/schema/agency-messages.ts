import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const agencyMessages = pgTable(
  'agency_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 10 }).notNull(), // 'outbound' | 'inbound'
    channel: varchar('channel', { length: 10 }).notNull(), // 'sms' | 'email'
    content: text('content').notNull(),
    subject: varchar('subject', { length: 255 }), // for email messages
    category: varchar('category', { length: 30 }).notNull(), // 'onboarding' | 'weekly_digest' | 'action_prompt' | 'alert' | 'reply' | 'custom'
    promptType: varchar('prompt_type', { length: 30 }), // 'start_sequences' | 'schedule_callback' | 'confirm_action'
    actionPayload: jsonb('action_payload'), // { leadIds: [...], sequenceType: '...' }
    actionStatus: varchar('action_status', { length: 20 }), // 'pending' | 'replied' | 'executed' | 'expired'
    inReplyTo: uuid('in_reply_to'), // self-ref to original prompt
    clientReply: text('client_reply'), // raw reply text
    twilioSid: varchar('twilio_sid', { length: 50 }),
    delivered: boolean('delivered').default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'), // when prompt stops accepting replies
  },
  (table) => [
    index('idx_agency_messages_client_id').on(table.clientId),
    index('idx_agency_messages_category').on(table.category),
    index('idx_agency_messages_action_status').on(table.actionStatus),
    index('idx_agency_messages_created_at').on(table.createdAt),
  ]
);

export type AgencyMessage = typeof agencyMessages.$inferSelect;
export type NewAgencyMessage = typeof agencyMessages.$inferInsert;
