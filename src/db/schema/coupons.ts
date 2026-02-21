import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }),

    // Discount type
    discountType: varchar('discount_type', { length: 20 }).notNull(),
    discountValue: integer('discount_value').notNull(),

    // Duration
    duration: varchar('duration', { length: 20 }).default('once'),
    durationMonths: integer('duration_months'),

    // Limits
    maxRedemptions: integer('max_redemptions'),
    timesRedeemed: integer('times_redeemed').default(0),

    // Validity
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),

    // Restrictions
    applicablePlans: jsonb('applicable_plans').$type<string[]>(),
    minAmountCents: integer('min_amount_cents'),
    firstTimeOnly: boolean('first_time_only').default(false),

    // Stripe
    stripeCouponId: varchar('stripe_coupon_id', { length: 100 }),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    uniqueIndex('coupons_code_idx').on(table.code),
  ]
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
