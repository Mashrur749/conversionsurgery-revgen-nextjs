import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

/** Supported calendar provider types */
export const calendarProviderEnum = pgEnum('calendar_provider', [
  'google',
  'jobber',
  'servicetitan',
  'housecall_pro',
  'outlook',
]);

/** Calendar integration records linking clients to external calendar providers */
export const calendarIntegrations = pgTable(
  'calendar_integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Provider info
    provider: calendarProviderEnum('provider').notNull(),
    isActive: boolean('is_active').notNull().default(true),

    // OAuth tokens
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),

    // Provider-specific IDs
    externalAccountId: varchar('external_account_id', { length: 255 }),
    calendarId: varchar('calendar_id', { length: 255 }), // For Google: specific calendar

    // Sync settings
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at'),
    syncDirection: varchar('sync_direction', { length: 20 }).notNull().default('both'), // inbound, outbound, both

    // Error tracking
    lastError: text('last_error'),
    consecutiveErrors: integer('consecutive_errors').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_calendar_integrations_client').on(table.clientId),
    index('idx_calendar_integrations_provider').on(table.provider),
  ]
);

/** Inferred select type for calendar_integrations rows */
export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;

/** Inferred insert type for calendar_integrations rows */
export type NewCalendarIntegration = typeof calendarIntegrations.$inferInsert;
