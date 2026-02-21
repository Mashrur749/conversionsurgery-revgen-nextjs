import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';

export const voiceCalls = pgTable(
  'voice_calls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    // Twilio info
    twilioCallSid: varchar('twilio_call_sid', { length: 50 }),
    from: varchar('from_number', { length: 20 }).notNull(),
    to: varchar('to_number', { length: 20 }).notNull(),

    // Call details
    direction: varchar('direction', { length: 10 }).default('inbound'),
    status: varchar('status', { length: 20 }), // initiated, ringing, in-progress, completed, failed
    duration: integer('duration'), // seconds

    // AI interaction
    transcript: text('transcript'),
    aiSummary: text('ai_summary'),
    callerIntent: varchar('caller_intent', { length: 50 }), // quote, schedule, question, complaint, other
    callerSentiment: varchar('caller_sentiment', { length: 20 }), // positive, neutral, negative

    // Outcome
    outcome: varchar('outcome', { length: 30 }), // qualified, scheduled, transferred, voicemail, dropped
    callbackRequested: boolean('callback_requested').default(false),
    callbackTime: timestamp('callback_time'),
    transferredTo: varchar('transferred_to', { length: 20 }),

    // Recording
    recordingUrl: varchar('recording_url', { length: 500 }),
    recordingSid: varchar('recording_sid', { length: 50 }),

    // Timestamps
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_voice_calls_client_id').on(table.clientId),
    index('idx_voice_calls_lead_id').on(table.leadId),
    index('idx_voice_calls_call_sid').on(table.twilioCallSid),
  ]
);

export type VoiceCall = typeof voiceCalls.$inferSelect;
export type NewVoiceCall = typeof voiceCalls.$inferInsert;
