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
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Plan identity
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    description: text('description'),

    // Pricing (in cents)
    priceMonthly: integer('price_monthly').notNull(),
    priceYearly: integer('price_yearly'),
    priceSetupCents: integer('price_setup_cents').default(0).notNull(),

    // Stripe IDs
    stripePriceIdMonthly: varchar('stripe_price_id_monthly', { length: 100 }),
    stripePriceIdYearly: varchar('stripe_price_id_yearly', { length: 100 }),
    stripePriceIdSetup: varchar('stripe_price_id_setup', { length: 100 }),
    stripeProductId: varchar('stripe_product_id', { length: 100 }),

    // Tier availability
    maxActiveClients: integer('max_active_clients'),
    publiclyVisible: boolean('publicly_visible').default(false).notNull(),

    // Features/limits
    features: jsonb('features').$type<{
      maxLeadsPerMonth: number | null;
      maxMessagesPerMonth?: number | null;
      maxTeamMembers: number | null;
      maxPhoneNumbers: number;
      includesVoiceAi: boolean;
      includesCalendarSync: boolean;
      includesAdvancedAnalytics: boolean;
      includesWhiteLabel: boolean;
      supportLevel: 'email' | 'priority' | 'dedicated';
      apiAccess: boolean;
      // Overage pricing (cents per unit above limit)
      overagePerLeadCents?: number;
      overagePerSmsCents?: number;
      allowOverages?: boolean; // false = hard cap at limit
      // Offer-parity policy flags
      isUnlimitedMessaging?: boolean;
      isUnlimitedLeads?: boolean;
      chargesOverage?: boolean;
    }>().notNull(),

    // Trial settings
    trialDays: integer('trial_days').default(14),

    // Display
    isPopular: boolean('is_popular').default(false),
    displayOrder: integer('display_order').default(0),
    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_plans_slug').on(table.slug),
    index('idx_plans_display_order').on(table.displayOrder),
    check('plans_price_monthly_non_negative', sql`${table.priceMonthly} >= 0`),
    check('plans_price_setup_non_negative', sql`${table.priceSetupCents} >= 0`),
    check('plans_max_active_clients_positive', sql`${table.maxActiveClients} IS NULL OR ${table.maxActiveClients} > 0`),
  ]
);

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
