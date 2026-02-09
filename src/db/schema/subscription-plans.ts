import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    description: text('description'),

    // Pricing (in cents)
    priceMonthly: integer('price_monthly').notNull(),
    priceYearly: integer('price_yearly').notNull(),

    // Stripe IDs
    stripePriceIdMonthly: varchar('stripe_price_id_monthly', { length: 255 }),
    stripePriceIdYearly: varchar('stripe_price_id_yearly', { length: 255 }),
    stripeProductId: varchar('stripe_product_id', { length: 255 }),

    // Included quotas
    includedLeads: integer('included_leads').default(100),
    includedMessages: integer('included_messages').default(1000),
    includedTeamMembers: integer('included_team_members').default(2),
    includedPhoneNumbers: integer('included_phone_numbers').default(1),

    // Features list
    features: jsonb('features').$type<string[]>().default([]),

    // Display
    sortOrder: integer('sort_order').default(0),
    isPublic: boolean('is_public').default(true),
    isPopular: boolean('is_popular').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_subscription_plans_slug').on(table.slug),
    index('idx_subscription_plans_sort_order').on(table.sortOrder),
  ]
);

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
