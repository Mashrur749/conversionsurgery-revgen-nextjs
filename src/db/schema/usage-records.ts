import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { subscriptions } from './subscriptions';
import { subscriptionInvoices } from './subscription-invoices';

export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),

    // Usage type
    usageType: varchar('usage_type', { length: 50 }).notNull(),

    // Quantities
    quantity: integer('quantity').notNull(),
    unitAmountCents: integer('unit_amount_cents'),

    // Period
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),

    // Whether this was reported to Stripe
    reportedToStripe: boolean('reported_to_stripe').default(false),
    stripeUsageRecordId: varchar('stripe_usage_record_id', { length: 100 }),

    // Billing
    billedOnInvoiceId: uuid('billed_on_invoice_id').references(() => subscriptionInvoices.id),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('usage_records_client_period_idx').on(
      table.clientId,
      table.periodStart,
      table.periodEnd
    ),
    index('usage_records_type_idx').on(table.usageType),
  ]
);

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
