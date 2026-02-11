import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';
import { jobs } from './jobs';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    description: text('description'),

    // Legacy amount field (numeric, dollars)
    amount: numeric('amount', { precision: 10, scale: 2 }),

    // New amount fields (integer, cents) for Stripe integration
    totalAmount: integer('total_amount'),
    paidAmount: integer('paid_amount').default(0),
    remainingAmount: integer('remaining_amount'),

    dueDate: date('due_date'),
    status: varchar('status', { length: 20 }).default('pending'), // pending, reminded, paid, partial, overdue, cancelled, refunded
    paymentLink: varchar('payment_link', { length: 500 }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_invoices_client').on(table.clientId),
    index('idx_invoices_lead').on(table.leadId),
    index('idx_invoices_status').on(table.status),
  ]
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
