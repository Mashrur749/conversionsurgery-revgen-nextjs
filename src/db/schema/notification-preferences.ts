import {
  pgTable,
  uuid,
  boolean,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  clientId: uuid('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .unique(),

  // SMS Notifications
  smsNewLead: boolean('sms_new_lead').default(true),
  smsEscalation: boolean('sms_escalation').default(true),
  smsWeeklySummary: boolean('sms_weekly_summary').default(true),
  smsFlowApproval: boolean('sms_flow_approval').default(true),
  smsNegativeReview: boolean('sms_negative_review').default(true),

  // Email Notifications
  emailNewLead: boolean('email_new_lead').default(false),
  emailDailySummary: boolean('email_daily_summary').default(false),
  emailWeeklySummary: boolean('email_weekly_summary').default(true),
  emailMonthlyReport: boolean('email_monthly_report').default(true),

  // Quiet Hours
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }).default('22:00'),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).default('07:00'),

  // Urgency Override (always notify for urgent even in quiet hours)
  urgentOverride: boolean('urgent_override').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
