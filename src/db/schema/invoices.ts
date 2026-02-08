import {
  pgTable,
  uuid,
  varchar,
  date,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    amount: numeric('amount', { precision: 10, scale: 2 }),
    dueDate: date('due_date'),
    status: varchar('status', { length: 20 }).default('pending'), // pending, reminded, paid, overdue
    paymentLink: varchar('payment_link', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => []
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
