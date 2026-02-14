import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    ownerName: varchar('owner_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }).notNull(),
    twilioNumber: varchar('twilio_number', { length: 20 }),
    googleBusinessUrl: varchar('google_business_url', { length: 500 }),
    googleAccessToken: varchar('google_access_token', { length: 500 }),
    googleRefreshToken: varchar('google_refresh_token', { length: 500 }),
    googleTokenExpiresAt: timestamp('google_token_expires_at'),
    googleBusinessAccountId: varchar('google_business_account_id', { length: 100 }),
    googleLocationId: varchar('google_location_id', { length: 100 }),
    timezone: varchar('timezone', { length: 50 }).default('America/Edmonton'),

    // ============================================
    // FEATURE FLAGS
    // ============================================

    // Core SMS
    missedCallSmsEnabled: boolean('missed_call_sms_enabled').default(true),
    aiResponseEnabled: boolean('ai_response_enabled').default(true),

    // AI Agent
    aiAgentEnabled: boolean('ai_agent_enabled').default(true),
    aiAgentMode: varchar('ai_agent_mode', { length: 20 }).default('assist'), // 'off', 'assist', 'autonomous'
    autoEscalationEnabled: boolean('auto_escalation_enabled').default(true),

    // Automation
    flowsEnabled: boolean('flows_enabled').default(true),
    leadScoringEnabled: boolean('lead_scoring_enabled').default(true),

    // Integrations
    calendarSyncEnabled: boolean('calendar_sync_enabled').default(false),
    hotTransferEnabled: boolean('hot_transfer_enabled').default(false),
    paymentLinksEnabled: boolean('payment_links_enabled').default(false),

    // Reputation
    reputationMonitoringEnabled: boolean('reputation_monitoring_enabled').default(false),
    autoReviewResponseEnabled: boolean('auto_review_response_enabled').default(false),

    // Communication
    photoRequestsEnabled: boolean('photo_requests_enabled').default(true),
    multiLanguageEnabled: boolean('multi_language_enabled').default(false),
    preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),

    // ============================================
    // NOTIFICATIONS
    // ============================================
    notificationEmail: boolean('notification_email').default(true),
    notificationSms: boolean('notification_sms').default(true),
    webhookUrl: varchar('webhook_url', { length: 500 }),
    webhookEvents: jsonb('webhook_events').default(
      sql`'["lead.created", "lead.qualified", "appointment.booked"]'`
    ),
    messagesSentThisMonth: integer('messages_sent_this_month').default(0),
    monthlyMessageLimit: integer('monthly_message_limit').default(500),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    status: varchar('status', { length: 20 }).default('active'), // active, paused, cancelled
    weeklySummaryEnabled: boolean('weekly_summary_enabled').default(true),
    weeklySummaryDay: integer('weekly_summary_day').default(1), // 0=Sun, 1=Mon
    weeklySummaryTime: varchar('weekly_summary_time', { length: 5 }).default('08:00'),
    lastWeeklySummaryAt: timestamp('last_weekly_summary_at'),
    isTest: boolean('is_test').default(false),
    // Voice AI
    voiceEnabled: boolean('voice_enabled').default(false),
    voiceMode: varchar('voice_mode', { length: 20 }).default('after_hours'), // always, after_hours, overflow
    voiceGreeting: text('voice_greeting'),
    voiceVoiceId: varchar('voice_voice_id', { length: 100 }), // ElevenLabs voice ID
    voiceMaxDuration: integer('voice_max_duration').default(300), // seconds

    // Speed-to-lead: how long it took before ConversionSurgery (minutes)
    previousResponseTimeMinutes: integer('previous_response_time_minutes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_clients_status').on(table.status),
  ]
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
