import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  time,
  timestamp,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

/**
 * Client Agent Settings — per-client AI configuration
 * Controls personality, behavior, goals, escalation thresholds, and quiet hours
 */
export const clientAgentSettings = pgTable('client_agent_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .unique()
    .references(() => clients.id, { onDelete: 'cascade' }),

  // AI personality
  agentName: varchar('agent_name', { length: 50 }).default('Assistant'),
  agentTone: varchar('agent_tone', { length: 30 }).default('professional'), // professional, friendly, casual

  // Response settings
  maxResponseLength: integer('max_response_length').default(300),
  useEmojis: boolean('use_emojis').default(false),
  signMessages: boolean('sign_messages').default(false),

  // Behavior settings
  autoRespond: boolean('auto_respond').default(true),
  respondOutsideHours: boolean('respond_outside_hours').default(true),
  maxDailyMessagesPerLead: integer('max_daily_messages_per_lead').default(5),
  minTimeBetweenMessages: integer('min_time_between_messages').default(60), // seconds

  // Goal settings
  primaryGoal: varchar('primary_goal', { length: 30 }).default(
    'book_appointment'
  ), // book_appointment, get_quote_request, collect_info
  bookingAggressiveness: integer('booking_aggressiveness').default(5), // 1-10
  maxBookingAttempts: integer('max_booking_attempts').default(3),

  // Escalation thresholds
  autoEscalateAfterMessages: integer('auto_escalate_after_messages'), // null = never
  autoEscalateOnNegativeSentiment: boolean(
    'auto_escalate_on_negative_sentiment'
  ).default(true),
  autoEscalateOnHighValue: integer('auto_escalate_on_high_value'), // Dollar threshold

  // Knowledge boundaries
  canDiscussPricing: boolean('can_discuss_pricing').default(false),
  canScheduleAppointments: boolean('can_schedule_appointments').default(true),
  canSendPaymentLinks: boolean('can_send_payment_links').default(false),

  // Quiet hours (use client's timezone)
  quietHoursEnabled: boolean('quiet_hours_enabled').default(true),
  quietHoursStart: time('quiet_hours_start').default('21:00'),
  quietHoursEnd: time('quiet_hours_end').default('08:00'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ClientAgentSettings = typeof clientAgentSettings.$inferSelect;
export type NewClientAgentSettings = typeof clientAgentSettings.$inferInsert;
