import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const webhookLog = pgTable(
  'webhook_log',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }),
    payload: jsonb('payload'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => []
);

export type WebhookLog = typeof webhookLog.$inferSelect;
export type NewWebhookLog = typeof webhookLog.$inferInsert;
