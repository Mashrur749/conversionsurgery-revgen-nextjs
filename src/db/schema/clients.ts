import {
  pgTable,
  uuid,
  varchar,
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
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    ownerName: varchar('owner_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }).notNull(),
    twilioNumber: varchar('twilio_number', { length: 20 }),
    googleBusinessUrl: varchar('google_business_url', { length: 500 }),
    timezone: varchar('timezone', { length: 50 }).default('America/Edmonton'),
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
    isTest: boolean('is_test').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_clients_status').on(table.status),
  ]
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
