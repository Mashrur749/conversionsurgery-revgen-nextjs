import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { subscriptionInvoices } from './subscription-invoices';

export const addonBillingEvents = pgTable(
  'addon_billing_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    addonType: varchar('addon_type', { length: 40 }).notNull(),
    sourceType: varchar('source_type', { length: 40 }).notNull(),
    sourceRef: text('source_ref'),
    invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id, { onDelete: 'set null' }),
    invoiceLineItemRef: varchar('invoice_line_item_ref', { length: 160 }),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    disputeStatus: varchar('dispute_status', { length: 20 }).default('none').notNull(),
    disputeNote: text('dispute_note'),
    disputedAt: timestamp('disputed_at'),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: varchar('resolved_by', { length: 120 }),
    idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_addon_billing_events_client').on(table.clientId, table.periodStart),
    index('idx_addon_billing_events_type').on(table.addonType, table.status),
    index('idx_addon_billing_events_invoice').on(table.invoiceId),
    index('idx_addon_billing_events_dispute').on(table.clientId, table.disputeStatus),
    uniqueIndex('uq_addon_billing_events_idempotency').on(table.idempotencyKey),
  ]
);

export type AddonBillingEvent = typeof addonBillingEvents.$inferSelect;
export type NewAddonBillingEvent = typeof addonBillingEvents.$inferInsert;
