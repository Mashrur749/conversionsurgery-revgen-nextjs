import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { leads } from './leads';
import { clients } from './clients';
import { teamMembers } from './team-members';

/**
 * Log of call attempts made to team members during hot transfer
 */
export const callAttempts = pgTable(
  'call_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    callSid: varchar('call_sid', { length: 50 }),
    status: varchar('status', { length: 20 }), // ringing, answered, failed, no-answer, busy
    answeredBy: uuid('answered_by').references(() => teamMembers.id, { onDelete: 'set null' }),
    duration: integer('duration'), // seconds
    recordingUrl: varchar('recording_url', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    answeredAt: timestamp('answered_at'),
    endedAt: timestamp('ended_at'),
  },
  (table) => [
    index('idx_call_attempts_lead_id').on(table.leadId),
    index('idx_call_attempts_client_id').on(table.clientId),
    index('idx_call_attempts_status').on(table.status),
  ]
);

export type CallAttempt = typeof callAttempts.$inferSelect;
export type NewCallAttempt = typeof callAttempts.$inferInsert;
