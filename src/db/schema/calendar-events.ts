import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';
import { teamMembers } from './team-members';
import { jobs } from './jobs';
import { calendarProviderEnum } from './calendar-integrations';

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    // Event details
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    location: text('location'),

    // Timing
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    isAllDay: boolean('is_all_day').default(false),
    timezone: varchar('timezone', { length: 50 }).default('America/Denver'),

    // Status
    status: varchar('status', { length: 20 }).default('scheduled'), // scheduled, confirmed, completed, cancelled, no_show

    // External sync
    provider: calendarProviderEnum('provider'),
    externalEventId: varchar('external_event_id', { length: 255 }),
    lastSyncedAt: timestamp('last_synced_at'),
    syncStatus: varchar('sync_status', { length: 20 }).default('pending'), // pending, synced, error

    // Assignment
    assignedTeamMemberId: uuid('assigned_team_member_id').references(() => teamMembers.id),

    // Metadata
    eventType: varchar('event_type', { length: 50 }), // estimate, job, follow_up, consultation
    jobId: uuid('job_id').references(() => jobs.id),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_calendar_events_client').on(table.clientId),
    index('idx_calendar_events_time').on(table.startTime),
    index('idx_calendar_events_external').on(table.provider, table.externalEventId),
  ]
);

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
