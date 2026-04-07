import { pgEnum } from 'drizzle-orm/pg-core';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]);

export const planIntervalEnum = pgEnum('plan_interval', [
  'month',
  'year',
]);

export const guaranteeStatusEnum = pgEnum('guarantee_status', [
  // Legacy values (kept for backward compatibility)
  'pending',
  'fulfilled',
  'refund_review_required',
  // V2 values
  'proof_pending',
  'proof_passed',
  'proof_failed_refund_review',
  'recovery_pending',
  'recovery_passed',
  'recovery_failed_refund_review',
]);

export type GuaranteeStatus = (typeof guaranteeStatusEnum.enumValues)[number];
