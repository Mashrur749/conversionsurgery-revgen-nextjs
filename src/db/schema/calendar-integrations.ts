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
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const calendarProviderEnum = pgEnum('calendar_provider', [
  'google',
  'jobber',
  'servicetitan',
  'housecall_pro',
  'outlook',
]);

export const calendarIntegrations = pgTable(
  'calendar_integrations',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),

    // Provider info
    provider: calendarProviderEnum('provider').notNull(),
    isActive: boolean('is_active').default(true),

    // OAuth tokens
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),

    // Provider-specific IDs
    externalAccountId: varchar('external_account_id', { length: 255 }),
    calendarId: varchar('calendar_id', { length: 255 }), // For Google: specific calendar

    // Sync settings
    syncEnabled: boolean('sync_enabled').default(true),
    lastSyncAt: timestamp('last_sync_at'),
    syncDirection: varchar('sync_direction', { length: 20 }).default('both'), // inbound, outbound, both

    // Error tracking
    lastError: text('last_error'),
    consecutiveErrors: integer('consecutive_errors').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_calendar_integrations_client').on(table.clientId),
    index('idx_calendar_integrations_provider').on(table.provider),
  ]
);

export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type NewCalendarIntegration = typeof calendarIntegrations.$inferInsert;
