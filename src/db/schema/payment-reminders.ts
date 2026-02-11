import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { payments } from './payments';
import { invoices } from './invoices';

export const paymentReminders = pgTable(
  'payment_reminders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }),

    // Reminder details
    reminderNumber: integer('reminder_number').default(1),
    sentAt: timestamp('sent_at'),
    messageContent: text('message_content'),

    // Response tracking
    leadReplied: boolean('lead_replied').default(false),
    replyContent: text('reply_content'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_payment_reminders_payment').on(table.paymentId),
    index('idx_payment_reminders_invoice').on(table.invoiceId),
  ]
);

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type NewPaymentReminder = typeof paymentReminders.$inferInsert;
