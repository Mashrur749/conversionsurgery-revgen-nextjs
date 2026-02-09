import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

// Monthly summaries (for billing and reports)
export const apiUsageMonthly = pgTable(
  'api_usage_monthly',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    month: varchar('month', { length: 7 }).notNull(), // "2026-02"

    // Cost by service (cents)
    openaiCostCents: integer('openai_cost_cents').default(0).notNull(),
    twilioSmsCostCents: integer('twilio_sms_cost_cents').default(0).notNull(),
    twilioVoiceCostCents: integer('twilio_voice_cost_cents').default(0).notNull(),
    twilioPhoneCostCents: integer('twilio_phone_cost_cents').default(0).notNull(),
    stripeCostCents: integer('stripe_cost_cents').default(0).notNull(),
    googlePlacesCostCents: integer('google_places_cost_cents').default(0).notNull(),
    storageCostCents: integer('storage_cost_cents').default(0).notNull(),
    totalCostCents: integer('total_cost_cents').default(0).notNull(),

    // Volume metrics
    totalMessages: integer('total_messages').default(0).notNull(),
    totalAiCalls: integer('total_ai_calls').default(0).notNull(),
    totalVoiceMinutes: integer('total_voice_minutes').default(0).notNull(),

    // Comparison
    previousMonthCostCents: integer('previous_month_cost_cents'),
    costChangePercent: integer('cost_change_percent'),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('api_usage_monthly_unique_idx').on(table.clientId, table.month),
    index('api_usage_monthly_month_idx').on(table.month),
  ]
);

export type ApiUsageMonthly = typeof apiUsageMonthly.$inferSelect;
export type NewApiUsageMonthly = typeof apiUsageMonthly.$inferInsert;
