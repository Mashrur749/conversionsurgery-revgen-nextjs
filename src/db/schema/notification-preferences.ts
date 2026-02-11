import {
  pgTable,
  uuid,
  boolean,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  // SMS Notifications
  smsNewLead: boolean('sms_new_lead').notNull().default(true),
  smsEscalation: boolean('sms_escalation').notNull().default(true),
  smsWeeklySummary: boolean('sms_weekly_summary').notNull().default(true),
  smsFlowApproval: boolean('sms_flow_approval').notNull().default(true),
  smsNegativeReview: boolean('sms_negative_review').notNull().default(true),

  // Email Notifications
  emailNewLead: boolean('email_new_lead').notNull().default(false),
  emailDailySummary: boolean('email_daily_summary').notNull().default(false),
  emailWeeklySummary: boolean('email_weekly_summary').notNull().default(true),
  emailMonthlyReport: boolean('email_monthly_report').notNull().default(true),

  // Quiet Hours
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }).notNull().default('22:00'),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).notNull().default('07:00'),

  // Urgency Override (always notify for urgent even in quiet hours)
  urgentOverride: boolean('urgent_override').notNull().default(true),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
