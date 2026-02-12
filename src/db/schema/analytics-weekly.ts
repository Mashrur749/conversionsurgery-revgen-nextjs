import {
  pgTable,
  uuid,
  date,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

// Weekly aggregates
export const analyticsWeekly = pgTable(
  'analytics_weekly',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(), // Monday of the week

    // Aggregated from daily
    newLeads: integer('new_leads').default(0).notNull(),
    totalConversations: integer('total_conversations').default(0).notNull(),
    appointmentsBooked: integer('appointments_booked').default(0).notNull(),
    jobsWon: integer('jobs_won').default(0).notNull(),
    revenueAttributedCents: integer('revenue_attributed_cents').default(0).notNull(),
    paymentsCollectedCents: integer('payments_collected_cents').default(0).notNull(),

    // Conversion rates (percentage * 100 for precision, e.g. 2500 = 25.00%)
    leadToAppointmentRate: integer('lead_to_appointment_rate'),
    appointmentToJobRate: integer('appointment_to_job_rate'),
    overallConversionRate: integer('overall_conversion_rate'),

    // Response metrics
    avgResponseTimeSeconds: integer('avg_response_time_seconds'),
    responseWithinFiveMin: integer('response_within_five_min'), // percentage

    // Week-over-week changes
    leadsChangePercent: integer('leads_change_percent'),
    revenueChangePercent: integer('revenue_change_percent'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('analytics_weekly_unique_idx').on(table.clientId, table.weekStart),
  ]
);

export type AnalyticsWeekly = typeof analyticsWeekly.$inferSelect;
export type NewAnalyticsWeekly = typeof analyticsWeekly.$inferInsert;
