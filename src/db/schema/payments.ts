import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';
import { invoices } from './invoices';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    // Payment details
    type: varchar('type', { length: 20 }).default('full'), // deposit, progress, final, full
    amount: integer('amount').notNull(), // in cents
    description: text('description'),

    // Stripe
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 100 }),
    stripePaymentLinkId: varchar('stripe_payment_link_id', { length: 100 }),
    stripePaymentLinkUrl: varchar('stripe_payment_link_url', { length: 500 }),

    // Status
    status: varchar('status', { length: 20 }).default('pending'), // pending, paid, partial, overdue, cancelled, refunded
    paidAt: timestamp('paid_at'),

    // Link tracking
    linkSentAt: timestamp('link_sent_at'),
    linkOpenedAt: timestamp('link_opened_at'),
    linkExpiresAt: timestamp('link_expires_at'),

    // Metadata
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_payments_client').on(table.clientId),
    index('idx_payments_lead').on(table.leadId),
    index('idx_payments_invoice').on(table.invoiceId),
    index('idx_payments_status').on(table.status),
    index('idx_payments_stripe_link').on(table.stripePaymentLinkId),
  ]
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
