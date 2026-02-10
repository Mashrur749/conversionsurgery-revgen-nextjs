import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { subscriptions } from './subscriptions';
import { subscriptionInvoices } from './subscription-invoices';
import { billingPaymentMethods } from './billing-payment-methods';

export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),

    eventType: varchar('event_type', { length: 50 }).notNull(),

    description: text('description'),

    // Related entities
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id),
    paymentMethodId: uuid('payment_method_id').references(() => billingPaymentMethods.id),

    // Amounts involved
    amountCents: integer('amount_cents'),

    // Stripe event data
    stripeEventId: varchar('stripe_event_id', { length: 100 }),
    stripeEventType: varchar('stripe_event_type', { length: 100 }),
    rawData: jsonb('raw_data').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('billing_events_client_idx').on(table.clientId),
    index('billing_events_type_idx').on(table.eventType),
    uniqueIndex('billing_events_stripe_idx').on(table.stripeEventId),
    index('billing_events_created_idx').on(table.createdAt),
  ]
);

export type BillingEvent = typeof billingEvents.$inferSelect;
export type NewBillingEvent = typeof billingEvents.$inferInsert;
