import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

/**
 * Client Services — master catalog of services each client offers.
 * Used for revenue attribution, AI classification, and ROI reporting.
 */
export const clientServices = pgTable(
  'client_services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 200 }).notNull(),
    category: varchar('category', { length: 100 }),

    // Price range in cents
    avgValueCents: integer('avg_value_cents'),
    priceRangeMinCents: integer('price_range_min_cents'),
    priceRangeMaxCents: integer('price_range_max_cents'),

    // AI pricing disclosure control
    canDiscussPrice: varchar('can_discuss_price', { length: 20 })
      .default('defer')
      .notNull(), // 'yes_range' | 'defer' | 'never'

    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_client_services_client').on(table.clientId),
    index('idx_client_services_active').on(table.clientId, table.isActive),
  ]
);

export type ClientService = typeof clientServices.$inferSelect;
export type NewClientService = typeof clientServices.$inferInsert;
