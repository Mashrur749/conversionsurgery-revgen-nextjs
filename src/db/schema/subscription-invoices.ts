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
import { billingPaymentMethods } from './billing-payment-methods';

export const subscriptionInvoices = pgTable(
  'subscription_invoices',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),

    // Stripe IDs
    stripeInvoiceId: varchar('stripe_invoice_id', { length: 100 }),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 100 }),

    // Invoice details
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    status: varchar('status', { length: 20 }).default('draft'),

    // Amounts (cents)
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').default(0),
    taxCents: integer('tax_cents').default(0),
    totalCents: integer('total_cents').notNull(),
    amountPaidCents: integer('amount_paid_cents').default(0),
    amountDueCents: integer('amount_due_cents').notNull(),

    // Currency
    currency: varchar('currency', { length: 3 }).default('usd'),

    // Line items
    lineItems: jsonb('line_items').$type<Array<{
      description: string;
      quantity: number;
      unitAmountCents: number;
      totalCents: number;
      period?: { start: string; end: string };
    }>>().default([]),

    // Dates
    invoiceDate: timestamp('invoice_date').defaultNow(),
    dueDate: timestamp('due_date'),
    paidAt: timestamp('paid_at'),

    // Period covered
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),

    // PDF
    pdfUrl: text('pdf_url'),
    hostedInvoiceUrl: text('hosted_invoice_url'),

    // Payment details
    paymentMethodId: uuid('payment_method_id').references(() => billingPaymentMethods.id),
    paymentAttempts: integer('payment_attempts').default(0),
    lastPaymentError: text('last_payment_error'),
    nextPaymentAttempt: timestamp('next_payment_attempt'),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('subscription_invoices_client_idx').on(table.clientId),
    uniqueIndex('subscription_invoices_stripe_idx').on(table.stripeInvoiceId),
    index('subscription_invoices_status_idx').on(table.status),
    index('subscription_invoices_date_idx').on(table.invoiceDate),
  ]
);

export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
export type NewSubscriptionInvoice = typeof subscriptionInvoices.$inferInsert;
