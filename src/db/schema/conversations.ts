import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 10 }), // inbound, outbound
    messageType: varchar('message_type', { length: 20 }), // sms, ai_response, contractor_response, system
    content: text('content').notNull(),
    twilioSid: varchar('twilio_sid', { length: 50 }),
    aiConfidence: numeric('ai_confidence', { precision: 3, scale: 2 }),
    deliveryStatus: varchar('delivery_status', { length: 20 }), // queued, sent, delivered, failed, undelivered
    mediaUrl: jsonb('media_url').$type<string[]>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_conversations_lead_id').on(table.leadId),
    index('idx_conversations_client_id').on(table.clientId),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
