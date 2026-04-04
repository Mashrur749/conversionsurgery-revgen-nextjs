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
import { clients } from './clients';

/**
 * Generic webhook configuration for external integrations.
 * Supports Jobber, ServiceTitan, Housecall Pro, Zapier, and generic HTTP targets.
 * One row per client × provider × direction × event type.
 */
export const integrationWebhooks = pgTable(
  'integration_webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    /** Integration provider identifier */
    provider: varchar('provider', { length: 50 }).notNull(),
    // 'jobber' | 'servicetitan' | 'housecall_pro' | 'zapier' | 'generic'

    /** Whether this webhook receives events (inbound) or sends them (outbound) */
    direction: varchar('direction', { length: 10 }).notNull(),
    // 'outbound' | 'inbound'

    /** The event type this webhook is configured for */
    eventType: varchar('event_type', { length: 100 }).notNull(),
    // 'appointment_booked' | 'job_completed' | 'lead_won' | 'review_requested'

    /** Outbound: URL to POST events to */
    webhookUrl: text('webhook_url'),

    /** HMAC secret key used for signature verification (both inbound and outbound) */
    secretKey: varchar('secret_key', { length: 255 }),

    /** Whether this webhook is active */
    enabled: boolean('enabled').notNull().default(true),

    /** Timestamp of the most recent successful trigger */
    lastTriggeredAt: timestamp('last_triggered_at'),

    /** Number of consecutive delivery failures; auto-disables at 10 */
    failureCount: integer('failure_count').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_integration_webhooks_client_id').on(table.clientId),
    index('idx_integration_webhooks_client_provider').on(
      table.clientId,
      table.provider,
      table.direction
    ),
  ]
);

/** Inferred select type for integration_webhooks rows */
export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;

/** Inferred insert type for integration_webhooks rows */
export type NewIntegrationWebhook = typeof integrationWebhooks.$inferInsert;
