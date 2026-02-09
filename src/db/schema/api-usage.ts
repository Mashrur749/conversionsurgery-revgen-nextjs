import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';

export const apiServiceEnum = pgEnum('api_service', [
  'openai',
  'twilio_sms',
  'twilio_voice',
  'twilio_phone',
  'stripe',
  'google_places',
  'cloudflare_r2',
]);

// Granular usage records (every API call)
export const apiUsage = pgTable(
  'api_usage',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Service details
    service: apiServiceEnum('service').notNull(),
    operation: varchar('operation', { length: 50 }).notNull(),
    model: varchar('model', { length: 50 }),

    // Usage metrics
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    units: integer('units').default(1),

    // Cost in cents (avoids floating point issues)
    costCents: integer('cost_cents').notNull().default(0),

    // Context
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    messageId: uuid('message_id'),
    flowExecutionId: uuid('flow_execution_id'),

    // External reference
    externalId: varchar('external_id', { length: 100 }),

    // Additional data
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('api_usage_client_idx').on(table.clientId),
    index('api_usage_service_idx').on(table.service),
    index('api_usage_created_at_idx').on(table.createdAt),
    index('api_usage_client_date_idx').on(table.clientId, table.createdAt),
  ]
);

export type ApiUsage = typeof apiUsage.$inferSelect;
export type NewApiUsage = typeof apiUsage.$inferInsert;
