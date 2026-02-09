import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { payments } from './payments';
import { invoices } from './invoices';

export const paymentReminders = pgTable(
  'payment_reminders',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }),

    // Reminder details
    reminderNumber: integer('reminder_number').default(1),
    sentAt: timestamp('sent_at'),
    messageContent: text('message_content'),

    // Response tracking
    leadReplied: boolean('lead_replied').default(false),
    replyContent: text('reply_content'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_payment_reminders_payment').on(table.paymentId),
    index('idx_payment_reminders_invoice').on(table.invoiceId),
  ]
);

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type NewPaymentReminder = typeof paymentReminders.$inferInsert;
