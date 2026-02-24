import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { plans } from './plans';
import { subscriptionStatusEnum, planIntervalEnum } from './billing-enums';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    planId: uuid('plan_id')
      .references(() => plans.id, { onDelete: 'restrict' })
      .notNull(),

    // Status
    status: subscriptionStatusEnum('status').default('trialing').notNull(),

    // Billing interval
    interval: planIntervalEnum('interval').default('month').notNull(),

    // Stripe IDs
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
    stripePriceId: varchar('stripe_price_id', { length: 100 }),

    // Current period
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),

    // Trial
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),

    // Cancellation
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
    canceledAt: timestamp('canceled_at'),
    cancelReason: text('cancel_reason'),

    // Pause (for temporary holds)
    pausedAt: timestamp('paused_at'),
    resumesAt: timestamp('resumes_at'),

    // Discounts
    discountPercent: integer('discount_percent'),
    discountEndsAt: timestamp('discount_ends_at'),
    couponCode: varchar('coupon_code', { length: 50 }),

    // 30-day performance guarantee lifecycle
    guaranteeStartAt: timestamp('guarantee_start_at'),
    guaranteeEndsAt: timestamp('guarantee_ends_at'),
    guaranteeStatus: varchar('guarantee_status', { length: 40 }).default('proof_pending'),
    guaranteeProofStartAt: timestamp('guarantee_proof_start_at'),
    guaranteeProofEndsAt: timestamp('guarantee_proof_ends_at'),
    guaranteeRecoveryStartAt: timestamp('guarantee_recovery_start_at'),
    guaranteeRecoveryEndsAt: timestamp('guarantee_recovery_ends_at'),
    guaranteeAdjustedProofEndsAt: timestamp('guarantee_adjusted_proof_ends_at'),
    guaranteeAdjustedRecoveryEndsAt: timestamp('guarantee_adjusted_recovery_ends_at'),
    guaranteeObservedMonthlyLeadAverage: integer('guarantee_observed_monthly_lead_average'),
    guaranteeExtensionFactorBasisPoints: integer('guarantee_extension_factor_basis_points').default(10000),
    guaranteeProofQualifiedLeadEngagements: integer('guarantee_proof_qualified_lead_engagements').default(0),
    guaranteeRecoveryAttributedOpportunities: integer('guarantee_recovery_attributed_opportunities').default(0),
    guaranteeFulfilledAt: timestamp('guarantee_fulfilled_at'),
    guaranteeRecoveredLeadId: uuid('guarantee_recovered_lead_id'),
    guaranteeRefundEligibleAt: timestamp('guarantee_refund_eligible_at'),
    guaranteeRefundedAt: timestamp('guarantee_refunded_at'),
    guaranteeNotes: text('guarantee_notes'),

    // Usage-based add-ons
    additionalLeadsCents: integer('additional_leads_cents').default(0),
    additionalSmsCents: integer('additional_sms_cents').default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('subscriptions_client_idx').on(table.clientId),
    index('subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
    index('subscriptions_status_idx').on(table.status),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
