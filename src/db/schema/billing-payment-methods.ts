import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const billingPaymentMethods = pgTable(
  'billing_payment_methods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),

    // Stripe IDs
    stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 100 }).notNull(),

    // Card details (from Stripe, for display)
    type: varchar('type', { length: 20 }).default('card'),
    cardBrand: varchar('card_brand', { length: 20 }),
    cardLast4: varchar('card_last4', { length: 4 }),
    cardExpMonth: integer('card_exp_month'),
    cardExpYear: integer('card_exp_year'),

    // Bank account (for ACH)
    bankName: varchar('bank_name', { length: 100 }),
    bankLast4: varchar('bank_last4', { length: 4 }),

    // Status
    isDefault: boolean('is_default').default(false),

    // Billing address
    billingName: varchar('billing_name', { length: 200 }),
    billingEmail: varchar('billing_email', { length: 200 }),
    billingAddress: jsonb('billing_address').$type<{
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('billing_payment_methods_client_idx').on(table.clientId),
    uniqueIndex('billing_payment_methods_stripe_idx').on(table.stripePaymentMethodId),
  ]
);

export type BillingPaymentMethod = typeof billingPaymentMethods.$inferSelect;
export type NewBillingPaymentMethod = typeof billingPaymentMethods.$inferInsert;
