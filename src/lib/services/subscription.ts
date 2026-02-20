import { getDb } from '@/db';
import { subscriptions, plans, clients, billingEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import { validateAndRedeemCoupon } from '@/lib/services/coupon-validation';
import type Stripe from 'stripe';
import type { Subscription } from '@/db/schema/subscriptions';
import type { Plan } from '@/db/schema/plans';

type PlanInterval = 'month' | 'year';

interface PlanFeatures {
  maxLeadsPerMonth: number | null;
  maxTeamMembers: number | null;
  maxPhoneNumbers: number;
  includesVoiceAi: boolean;
  includesCalendarSync: boolean;
  includesAdvancedAnalytics: boolean;
  includesWhiteLabel: boolean;
  supportLevel: 'email' | 'priority' | 'dedicated';
  apiAccess: boolean;
}

/**
 * Create a new subscription for a client
 */
export async function createSubscription(
  clientId: string,
  planId: string,
  interval: PlanInterval = 'month',
  couponCode?: string
): Promise<Subscription> {
  const db = getDb();
  const stripe = getStripeClient();

  // Get client and plan
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) throw new Error('Client not found');

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) throw new Error('Plan not found');

  // Create or get Stripe customer
  let stripeCustomerId = client.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: client.email || undefined,
      name: client.businessName,
      metadata: {
        clientId: client.id,
      },
    }, {
      idempotencyKey: `cust_create_${clientId}`,
    });
    stripeCustomerId = customer.id;

    await db.update(clients).set({
      stripeCustomerId,
      updatedAt: new Date(),
    }).where(eq(clients.id, clientId));
  }

  // Get the appropriate price ID
  const priceId = interval === 'year'
    ? plan.stripePriceIdYearly
    : plan.stripePriceIdMonthly;

  if (!priceId) throw new Error('No Stripe price configured for this plan/interval');

  // Create Stripe subscription
  const stripeSubParams: Record<string, unknown> = {
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    trial_period_days: plan.trialDays || undefined,
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      clientId,
      planId,
    },
  };

  // Validate and atomically redeem coupon if provided
  // This uses a single UPDATE...WHERE to prevent race conditions on max_redemptions
  let validatedDiscount: { discountValue?: number; duration?: string; durationMonths?: number | null } | undefined;
  if (couponCode) {
    const couponResult = await validateAndRedeemCoupon(couponCode, planId, clientId);
    if (!couponResult.valid) {
      throw new Error(couponResult.error || 'Invalid coupon code');
    }
    validatedDiscount = {
      discountValue: couponResult.discountValue,
      duration: couponResult.duration,
      durationMonths: couponResult.durationMonths,
    };
    stripeSubParams.coupon = couponCode;
  }

  const stripeSubscription = await stripe.subscriptions.create(
    stripeSubParams as unknown as Stripe.SubscriptionCreateParams,
    { idempotencyKey: `sub_create_${clientId}_${planId}_${interval}_${Date.now()}` }
  );

  // Calculate trial dates
  const trialStart = stripeSubscription.trial_start
    ? new Date(stripeSubscription.trial_start * 1000)
    : null;
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;

  // In Stripe v20, current_period is on subscription items
  const firstItem = stripeSubscription.items.data[0];
  const currentPeriodStart = firstItem
    ? new Date(firstItem.current_period_start * 1000)
    : new Date();
  const currentPeriodEnd = firstItem
    ? new Date(firstItem.current_period_end * 1000)
    : new Date();

  // All DB writes after Stripe call are wrapped in a transaction.
  // If this transaction fails, the Stripe subscription still exists —
  // the reconciliation cron (E2) will detect and fix the discrepancy.
  try {
    const subscription = await db.transaction(async (tx) => {
      const [sub] = await tx.insert(subscriptions).values({
        clientId,
        planId,
        status: stripeSubscription.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
        interval,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        couponCode: couponCode?.toUpperCase(),
        discountPercent: validatedDiscount?.discountValue,
        discountEndsAt: validatedDiscount?.duration === 'repeating' && validatedDiscount.durationMonths
          ? new Date(Date.now() + validatedDiscount.durationMonths * 30 * 24 * 60 * 60 * 1000)
          : undefined,
      }).returning();

      // Log event
      await tx.insert(billingEvents).values({
        clientId,
        eventType: 'subscription_created',
        description: `Subscription created for ${plan.name} plan`,
        subscriptionId: sub.id,
        stripeEventId: `manual_${Date.now()}`,
      });

      return sub;
    });

    return subscription;
  } catch (error) {
    // Transaction failed — attempt to cancel the Stripe subscription
    // to prevent orphaned billing
    console.error('[Subscription] DB transaction failed after Stripe create, attempting compensation:', error);
    try {
      await stripe.subscriptions.cancel(stripeSubscription.id);
      console.log('[Subscription] Compensating Stripe cancel succeeded');
    } catch (cancelError) {
      console.error('[Subscription] Compensating Stripe cancel FAILED — manual reconciliation needed:', cancelError);
    }
    throw error;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
  cancelImmediately: boolean = false
): Promise<Subscription> {
  const db = getDb();
  const stripe = getStripeClient();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) throw new Error('Subscription not found');
  if (!subscription.stripeSubscriptionId) throw new Error('No Stripe subscription');

  // Cancel in Stripe
  if (cancelImmediately) {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {}, {
      idempotencyKey: `sub_cancel_${subscriptionId}_${Date.now()}`,
    });
  } else {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    }, {
      idempotencyKey: `sub_cancel_eop_${subscriptionId}_${Date.now()}`,
    });
  }

  // Wrap DB writes in transaction
  const updated = await db.transaction(async (tx) => {
    const [sub] = await tx.update(subscriptions).set({
      cancelAtPeriodEnd: !cancelImmediately,
      canceledAt: cancelImmediately ? new Date() : null,
      cancelReason: reason,
      status: cancelImmediately ? 'canceled' : subscription.status,
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, subscriptionId)).returning();

    await tx.insert(billingEvents).values({
      clientId: subscription.clientId,
      eventType: 'subscription_canceled',
      description: reason || 'Subscription canceled',
      subscriptionId,
    });

    return sub;
  });

  return updated;
}

/**
 * Change subscription plan
 */
export async function changePlan(
  subscriptionId: string,
  newPlanId: string,
  newInterval?: PlanInterval
): Promise<Subscription> {
  const db = getDb();
  const stripe = getStripeClient();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) throw new Error('Subscription not found');
  if (!subscription.stripeSubscriptionId) throw new Error('No Stripe subscription');

  const [newPlan] = await db.select().from(plans).where(eq(plans.id, newPlanId)).limit(1);
  if (!newPlan) throw new Error('New plan not found');

  const interval = newInterval || subscription.interval;
  const priceId = interval === 'year'
    ? newPlan.stripePriceIdYearly
    : newPlan.stripePriceIdMonthly;

  if (!priceId) throw new Error('No Stripe price for new plan');

  // Get current subscription from Stripe
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

  // Update subscription in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{
      id: stripeSub.items.data[0].id,
      price: priceId,
    }],
    proration_behavior: 'create_prorations',
  }, {
    idempotencyKey: `sub_change_${subscriptionId}_${newPlanId}_${interval}_${Date.now()}`,
  });

  // Wrap DB writes in transaction
  const updated = await db.transaction(async (tx) => {
    const [sub] = await tx.update(subscriptions).set({
      planId: newPlanId,
      interval,
      stripePriceId: priceId,
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, subscriptionId)).returning();

    await tx.insert(billingEvents).values({
      clientId: subscription.clientId,
      eventType: 'plan_changed',
      description: `Changed to ${newPlan.name} plan`,
      subscriptionId,
    });

    return sub;
  });

  return updated;
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(
  subscriptionId: string,
  resumeDate?: Date
): Promise<Subscription> {
  const db = getDb();
  const stripe = getStripeClient();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) throw new Error('Subscription not found');
  if (!subscription.stripeSubscriptionId) throw new Error('No Stripe subscription');

  // Pause in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    pause_collection: {
      behavior: 'mark_uncollectible',
      resumes_at: resumeDate ? Math.floor(resumeDate.getTime() / 1000) : undefined,
    },
  }, {
    idempotencyKey: `sub_pause_${subscriptionId}_${Date.now()}`,
  });

  // Update local record
  const [updated] = await db.update(subscriptions).set({
    status: 'paused',
    pausedAt: new Date(),
    resumesAt: resumeDate,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, subscriptionId)).returning();

  return updated;
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  const db = getDb();
  const stripe = getStripeClient();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) throw new Error('Subscription not found');
  if (!subscription.stripeSubscriptionId) throw new Error('No Stripe subscription');

  // Resume in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    pause_collection: '' as unknown as undefined,
  }, {
    idempotencyKey: `sub_resume_${subscriptionId}_${Date.now()}`,
  });

  // Update local record
  const [updated] = await db.update(subscriptions).set({
    status: 'active',
    pausedAt: null,
    resumesAt: null,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, subscriptionId)).returning();

  return updated;
}

/**
 * Get subscription with plan details
 */
export async function getSubscriptionWithPlan(clientId: string) {
  const db = getDb();

  const result = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  return result[0] || null;
}

/**
 * Check if client has access to a feature
 */
export async function hasFeatureAccess(
  clientId: string,
  feature: keyof PlanFeatures
): Promise<boolean> {
  const result = await getSubscriptionWithPlan(clientId);
  if (!result) return false;

  const { subscription, plan } = result;

  // Check subscription is active
  if (!['trialing', 'active'].includes(subscription.status)) {
    return false;
  }

  const features = plan.features as PlanFeatures;
  return !!features[feature];
}

/**
 * Check usage limits
 */
export async function checkUsageLimit(
  clientId: string,
  usageType: 'leads' | 'team_members' | 'phone_numbers',
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const result = await getSubscriptionWithPlan(clientId);
  if (!result) {
    return { allowed: false, limit: 0, current: currentCount };
  }

  const features = result.plan.features as PlanFeatures;

  const limitMap: Record<string, number | null> = {
    leads: features.maxLeadsPerMonth,
    team_members: features.maxTeamMembers,
    phone_numbers: features.maxPhoneNumbers,
  };

  const limit = limitMap[usageType] ?? null;

  return {
    allowed: limit === null || currentCount < limit,
    limit,
    current: currentCount,
  };
}
