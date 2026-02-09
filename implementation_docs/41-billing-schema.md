# Phase 41: Billing Schema

## Prerequisites
- Phase 15 (Usage Tracking) complete
- Phase 09-10 (Client CRUD) complete
- Stripe account configured

## Goal
Create the database schema and services to support:
1. Subscription management (plans, trials, upgrades/downgrades)
2. Invoice generation and history
3. Payment method management
4. Usage-based billing (overage tracking)
5. Stripe webhook handling

---

## Step 1: Create Billing Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// BILLING & SUBSCRIPTIONS
// ============================================

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

// Available plans/pricing
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Plan identity
  name: varchar('name', { length: 100 }).notNull(), // "Starter", "Pro", "Enterprise"
  slug: varchar('slug', { length: 50 }).notNull().unique(), // "starter", "pro", "enterprise"
  description: text('description'),
  
  // Pricing
  priceMonthly: integer('price_monthly').notNull(), // cents, e.g., 99700 = $997
  priceYearly: integer('price_yearly'), // cents, e.g., 997000 = $9,970 (2 months free)
  
  // Stripe IDs
  stripePriceIdMonthly: varchar('stripe_price_id_monthly', { length: 100 }),
  stripePriceIdYearly: varchar('stripe_price_id_yearly', { length: 100 }),
  stripeProductId: varchar('stripe_product_id', { length: 100 }),
  
  // Features/limits
  features: jsonb('features').$type<{
    maxLeadsPerMonth: number | null;  // null = unlimited
    maxTeamMembers: number | null;
    maxPhoneNumbers: number;
    includesVoiceAi: boolean;
    includesCalendarSync: boolean;
    includesAdvancedAnalytics: boolean;
    includesWhiteLabel: boolean;
    supportLevel: 'email' | 'priority' | 'dedicated';
    apiAccess: boolean;
  }>().notNull(),
  
  // Trial settings
  trialDays: integer('trial_days').default(14),
  
  // Display
  isPopular: boolean('is_popular').default(false),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Client subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull().unique(),
  planId: uuid('plan_id').references(() => plans.id).notNull(),
  
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
  discountPercent: integer('discount_percent'), // e.g., 20 = 20% off
  discountEndsAt: timestamp('discount_ends_at'),
  couponCode: varchar('coupon_code', { length: 50 }),
  
  // Usage-based add-ons
  additionalLeadsCents: integer('additional_leads_cents').default(0), // Per-lead overage cost
  additionalSmsCents: integer('additional_sms_cents').default(0), // Per-SMS overage
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: uniqueIndex('subscriptions_client_idx').on(table.clientId),
  stripeSubIdx: index('subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
}));

// Payment methods
export const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  // Stripe IDs
  stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 100 }).notNull(),
  
  // Card details (from Stripe, for display)
  type: varchar('type', { length: 20 }).default('card'), // card, bank_account, etc.
  cardBrand: varchar('card_brand', { length: 20 }), // visa, mastercard, amex
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
}, (table) => ({
  clientIdx: index('payment_methods_client_idx').on(table.clientId),
  stripeIdx: uniqueIndex('payment_methods_stripe_idx').on(table.stripePaymentMethodId),
}));

// Invoices
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  
  // Stripe IDs
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 100 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 100 }),
  
  // Invoice details
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  status: varchar('status', { length: 20 }).default('draft'), // draft, open, paid, void, uncollectible
  
  // Amounts (cents)
  subtotalCents: integer('subtotal_cents').notNull(),
  discountCents: integer('discount_cents').default(0),
  taxCents: integer('tax_cents').default(0),
  totalCents: integer('total_cents').notNull(),
  amountPaidCents: integer('amount_paid_cents').default(0),
  amountDueCents: integer('amount_due_cents').notNull(),
  
  // Currency
  currency: varchar('currency', { length: 3 }).default('usd'),
  
  // Line items
  lineItems: jsonb('line_items').$type<Array<{
    description: string;
    quantity: number;
    unitAmountCents: number;
    totalCents: number;
    period?: { start: string; end: string };
  }>>().default([]),
  
  // Dates
  invoiceDate: timestamp('invoice_date').defaultNow(),
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  
  // Period covered
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  
  // PDF
  pdfUrl: text('pdf_url'),
  hostedInvoiceUrl: text('hosted_invoice_url'),
  
  // Payment details
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
  paymentAttempts: integer('payment_attempts').default(0),
  lastPaymentError: text('last_payment_error'),
  nextPaymentAttempt: timestamp('next_payment_attempt'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('invoices_client_idx').on(table.clientId),
  stripeIdx: uniqueIndex('invoices_stripe_idx').on(table.stripeInvoiceId),
  statusIdx: index('invoices_status_idx').on(table.status),
  dateIdx: index('invoices_date_idx').on(table.invoiceDate),
}));

// Usage records (for metered billing)
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  
  // Usage type
  usageType: varchar('usage_type', { length: 50 }).notNull(), // 'leads', 'sms', 'voice_minutes', 'ai_tokens'
  
  // Quantities
  quantity: integer('quantity').notNull(),
  unitAmountCents: integer('unit_amount_cents'), // Cost per unit if overage
  
  // Period
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Whether this was reported to Stripe
  reportedToStripe: boolean('reported_to_stripe').default(false),
  stripeUsageRecordId: varchar('stripe_usage_record_id', { length: 100 }),
  
  // Billing
  billedOnInvoiceId: uuid('billed_on_invoice_id').references(() => invoices.id),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  clientPeriodIdx: index('usage_records_client_period_idx').on(
    table.clientId, 
    table.periodStart, 
    table.periodEnd
  ),
  typeIdx: index('usage_records_type_idx').on(table.usageType),
}));

// Billing events (audit log)
export const billingEvents = pgTable('billing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // Types: 'subscription_created', 'subscription_updated', 'subscription_canceled',
  // 'payment_succeeded', 'payment_failed', 'invoice_created', 'invoice_paid',
  // 'refund_created', 'dispute_created', 'plan_changed', etc.
  
  description: text('description'),
  
  // Related entities
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
  
  // Amounts involved
  amountCents: integer('amount_cents'),
  
  // Stripe event data
  stripeEventId: varchar('stripe_event_id', { length: 100 }),
  stripeEventType: varchar('stripe_event_type', { length: 100 }),
  rawData: jsonb('raw_data').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('billing_events_client_idx').on(table.clientId),
  eventTypeIdx: index('billing_events_type_idx').on(table.eventType),
  stripeEventIdx: uniqueIndex('billing_events_stripe_idx').on(table.stripeEventId),
  createdAtIdx: index('billing_events_created_idx').on(table.createdAt),
}));

// Coupons
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  
  // Discount type
  discountType: varchar('discount_type', { length: 20 }).notNull(), // 'percent' or 'fixed'
  discountValue: integer('discount_value').notNull(), // Percent (e.g., 20) or cents (e.g., 5000)
  
  // Duration
  duration: varchar('duration', { length: 20 }).default('once'), // 'once', 'repeating', 'forever'
  durationMonths: integer('duration_months'), // For 'repeating'
  
  // Limits
  maxRedemptions: integer('max_redemptions'),
  timesRedeemed: integer('times_redeemed').default(0),
  
  // Validity
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  
  // Restrictions
  applicablePlans: jsonb('applicable_plans').$type<string[]>(), // Plan IDs, null = all
  minAmountCents: integer('min_amount_cents'),
  firstTimeOnly: boolean('first_time_only').default(false),
  
  // Stripe
  stripeCouponId: varchar('stripe_coupon_id', { length: 100 }),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex('coupons_code_idx').on(table.code),
}));
```

---

## Step 2: Create Billing Type Exports

**CREATE** `src/lib/types/billing.ts`:

```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { 
  plans, 
  subscriptions, 
  paymentMethods, 
  invoices,
  usageRecords,
  billingEvents,
  coupons,
} from '@/lib/db/schema';

export type Plan = InferSelectModel<typeof plans>;
export type NewPlan = InferInsertModel<typeof plans>;

export type Subscription = InferSelectModel<typeof subscriptions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;

export type PaymentMethod = InferSelectModel<typeof paymentMethods>;
export type NewPaymentMethod = InferInsertModel<typeof paymentMethods>;

export type Invoice = InferSelectModel<typeof invoices>;
export type NewInvoice = InferInsertModel<typeof invoices>;

export type UsageRecord = InferSelectModel<typeof usageRecords>;
export type BillingEvent = InferSelectModel<typeof billingEvents>;
export type Coupon = InferSelectModel<typeof coupons>;

export type SubscriptionStatus = 
  | 'trialing' 
  | 'active' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid' 
  | 'paused';

export type PlanInterval = 'month' | 'year';

export interface PlanFeatures {
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

export interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmountCents: number;
  totalCents: number;
  period?: { start: string; end: string };
}
```

---

## Step 3: Create Stripe Client

**CREATE** `src/lib/clients/stripe.ts`:

```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
```

---

## Step 4: Create Subscription Service

**CREATE** `src/lib/services/subscription.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  subscriptions, 
  plans, 
  clients, 
  paymentMethods,
  billingEvents,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { stripe } from '@/lib/clients/stripe';
import type { Subscription, Plan, PlanInterval } from '@/lib/types/billing';

/**
 * Create a new subscription for a client
 */
export async function createSubscription(
  clientId: string,
  planId: string,
  interval: PlanInterval = 'month',
  couponCode?: string
): Promise<Subscription> {
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
  const stripeSubParams: Stripe.SubscriptionCreateParams = {
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
  
  if (couponCode) {
    stripeSubParams.coupon = couponCode;
  }
  
  const stripeSubscription = await stripe.subscriptions.create(stripeSubParams);
  
  // Calculate trial dates
  const trialStart = stripeSubscription.trial_start 
    ? new Date(stripeSubscription.trial_start * 1000) 
    : null;
  const trialEnd = stripeSubscription.trial_end 
    ? new Date(stripeSubscription.trial_end * 1000) 
    : null;
  
  // Create subscription record
  const [subscription] = await db.insert(subscriptions).values({
    clientId,
    planId,
    status: stripeSubscription.status as any,
    interval,
    stripeCustomerId,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    trialStart,
    trialEnd,
    couponCode,
  }).returning();
  
  // Log event
  await db.insert(billingEvents).values({
    clientId,
    eventType: 'subscription_created',
    description: `Subscription created for ${plan.name} plan`,
    subscriptionId: subscription.id,
    stripeEventId: `manual_${Date.now()}`,
  });
  
  return subscription;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
  cancelImmediately: boolean = false
): Promise<Subscription> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  
  if (!subscription) throw new Error('Subscription not found');
  if (!subscription.stripeSubscriptionId) throw new Error('No Stripe subscription');
  
  // Cancel in Stripe
  if (cancelImmediately) {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
  } else {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }
  
  // Update local record
  const [updated] = await db.update(subscriptions).set({
    cancelAtPeriodEnd: !cancelImmediately,
    canceledAt: cancelImmediately ? new Date() : null,
    cancelReason: reason,
    status: cancelImmediately ? 'canceled' : subscription.status,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, subscriptionId)).returning();
  
  // Log event
  await db.insert(billingEvents).values({
    clientId: subscription.clientId,
    eventType: 'subscription_canceled',
    description: reason || 'Subscription canceled',
    subscriptionId,
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
  });
  
  // Update local record
  const [updated] = await db.update(subscriptions).set({
    planId: newPlanId,
    interval,
    stripePriceId: priceId,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, subscriptionId)).returning();
  
  // Log event
  await db.insert(billingEvents).values({
    clientId: subscription.clientId,
    eventType: 'plan_changed',
    description: `Changed to ${newPlan.name} plan`,
    subscriptionId,
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
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  
  if (!subscription) throw new Error('Subscription not found');
  if (!subscription.stripeSubscriptionId) throw new Error('No Stripe subscription');
  
  // Resume in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    pause_collection: '',
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
  
  const features = plan.features as any;
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
  
  const features = result.plan.features as any;
  
  const limitMap = {
    leads: features.maxLeadsPerMonth,
    team_members: features.maxTeamMembers,
    phone_numbers: features.maxPhoneNumbers,
  };
  
  const limit = limitMap[usageType];
  
  return {
    allowed: limit === null || currentCount < limit,
    limit,
    current: currentCount,
  };
}
```

---

## Step 5: Create Payment Method Service

**CREATE** `src/lib/services/payment-methods.ts`:

```typescript
import { db } from '@/lib/db';
import { paymentMethods, subscriptions, clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { stripe } from '@/lib/clients/stripe';
import type { PaymentMethod } from '@/lib/types/billing';

/**
 * Create a setup intent for adding a new payment method
 */
export async function createSetupIntent(clientId: string): Promise<{
  clientSecret: string;
  setupIntentId: string;
}> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) throw new Error('Client not found');
  
  // Get or create Stripe customer
  let stripeCustomerId = client.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: client.email || undefined,
      name: client.businessName,
      metadata: { clientId },
    });
    stripeCustomerId = customer.id;
    
    await db.update(clients).set({ stripeCustomerId }).where(eq(clients.id, clientId));
  }
  
  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    metadata: { clientId },
  });
  
  return {
    clientSecret: setupIntent.client_secret!,
    setupIntentId: setupIntent.id,
  };
}

/**
 * Add a payment method after setup intent confirmation
 */
export async function addPaymentMethod(
  clientId: string,
  stripePaymentMethodId: string,
  setAsDefault: boolean = false
): Promise<PaymentMethod> {
  // Get payment method details from Stripe
  const stripePaymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
  
  // Check if already exists
  const [existing] = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId))
    .limit(1);
  
  if (existing) return existing;
  
  // If setting as default, unset other defaults
  if (setAsDefault) {
    await db.update(paymentMethods).set({ 
      isDefault: false,
      updatedAt: new Date(),
    }).where(eq(paymentMethods.clientId, clientId));
  }
  
  // Check if this is the first payment method
  const existingMethods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.clientId, clientId));
  
  const isFirstMethod = existingMethods.length === 0;
  
  // Create payment method record
  const [method] = await db.insert(paymentMethods).values({
    clientId,
    stripePaymentMethodId,
    type: stripePaymentMethod.type,
    cardBrand: stripePaymentMethod.card?.brand,
    cardLast4: stripePaymentMethod.card?.last4,
    cardExpMonth: stripePaymentMethod.card?.exp_month,
    cardExpYear: stripePaymentMethod.card?.exp_year,
    isDefault: setAsDefault || isFirstMethod,
    billingName: stripePaymentMethod.billing_details?.name,
    billingEmail: stripePaymentMethod.billing_details?.email,
    billingAddress: stripePaymentMethod.billing_details?.address ? {
      line1: stripePaymentMethod.billing_details.address.line1 || undefined,
      line2: stripePaymentMethod.billing_details.address.line2 || undefined,
      city: stripePaymentMethod.billing_details.address.city || undefined,
      state: stripePaymentMethod.billing_details.address.state || undefined,
      postalCode: stripePaymentMethod.billing_details.address.postal_code || undefined,
      country: stripePaymentMethod.billing_details.address.country || undefined,
    } : undefined,
  }).returning();
  
  // If default, update subscription's default payment method
  if (method.isDefault) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.clientId, clientId))
      .limit(1);
    
    if (subscription?.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        default_payment_method: stripePaymentMethodId,
      });
    }
    
    // Also update customer default
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (client?.stripeCustomerId) {
      await stripe.customers.update(client.stripeCustomerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId },
      });
    }
  }
  
  return method;
}

/**
 * Set a payment method as default
 */
export async function setDefaultPaymentMethod(
  clientId: string,
  paymentMethodId: string
): Promise<void> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(
      eq(paymentMethods.id, paymentMethodId),
      eq(paymentMethods.clientId, clientId)
    ))
    .limit(1);
  
  if (!method) throw new Error('Payment method not found');
  
  // Unset other defaults
  await db.update(paymentMethods).set({ 
    isDefault: false,
    updatedAt: new Date(),
  }).where(eq(paymentMethods.clientId, clientId));
  
  // Set this as default
  await db.update(paymentMethods).set({ 
    isDefault: true,
    updatedAt: new Date(),
  }).where(eq(paymentMethods.id, paymentMethodId));
  
  // Update Stripe
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);
  
  if (subscription?.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      default_payment_method: method.stripePaymentMethodId,
    });
  }
}

/**
 * Remove a payment method
 */
export async function removePaymentMethod(
  clientId: string,
  paymentMethodId: string
): Promise<void> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(
      eq(paymentMethods.id, paymentMethodId),
      eq(paymentMethods.clientId, clientId)
    ))
    .limit(1);
  
  if (!method) throw new Error('Payment method not found');
  if (method.isDefault) throw new Error('Cannot remove default payment method');
  
  // Detach from Stripe
  await stripe.paymentMethods.detach(method.stripePaymentMethodId);
  
  // Remove from database
  await db.delete(paymentMethods).where(eq(paymentMethods.id, paymentMethodId));
}

/**
 * Get all payment methods for a client
 */
export async function getPaymentMethods(clientId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.clientId, clientId))
    .orderBy(paymentMethods.isDefault);
}
```

---

## Step 6: Create Invoice Service

**CREATE** `src/lib/services/invoices.ts`:

```typescript
import { db } from '@/lib/db';
import { invoices, subscriptions } from '@/lib/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { stripe } from '@/lib/clients/stripe';
import type { Invoice } from '@/lib/types/billing';

/**
 * Sync invoice from Stripe
 */
export async function syncInvoiceFromStripe(stripeInvoiceId: string): Promise<Invoice> {
  const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);
  
  // Find client from subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeInvoice.subscription as string))
    .limit(1);
  
  if (!subscription) throw new Error('Subscription not found for invoice');
  
  // Map line items
  const lineItems = stripeInvoice.lines.data.map(line => ({
    description: line.description || '',
    quantity: line.quantity || 1,
    unitAmountCents: line.unit_amount || 0,
    totalCents: line.amount,
    period: line.period ? {
      start: new Date(line.period.start * 1000).toISOString(),
      end: new Date(line.period.end * 1000).toISOString(),
    } : undefined,
  }));
  
  // Upsert invoice
  const invoiceData = {
    clientId: subscription.clientId,
    subscriptionId: subscription.id,
    stripeInvoiceId,
    stripePaymentIntentId: stripeInvoice.payment_intent as string | undefined,
    invoiceNumber: stripeInvoice.number,
    status: stripeInvoice.status || 'draft',
    subtotalCents: stripeInvoice.subtotal,
    discountCents: stripeInvoice.total_discount_amounts?.reduce((sum, d) => sum + d.amount, 0) || 0,
    taxCents: stripeInvoice.tax || 0,
    totalCents: stripeInvoice.total,
    amountPaidCents: stripeInvoice.amount_paid,
    amountDueCents: stripeInvoice.amount_due,
    currency: stripeInvoice.currency,
    lineItems,
    invoiceDate: stripeInvoice.created ? new Date(stripeInvoice.created * 1000) : new Date(),
    dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
    paidAt: stripeInvoice.status_transitions?.paid_at 
      ? new Date(stripeInvoice.status_transitions.paid_at * 1000) 
      : null,
    periodStart: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : null,
    periodEnd: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : null,
    pdfUrl: stripeInvoice.invoice_pdf,
    hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
    updatedAt: new Date(),
  };
  
  // Check if exists
  const [existing] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);
  
  if (existing) {
    const [updated] = await db
      .update(invoices)
      .set(invoiceData)
      .where(eq(invoices.id, existing.id))
      .returning();
    return updated;
  } else {
    const [created] = await db.insert(invoices).values(invoiceData).returning();
    return created;
  }
}

/**
 * Get invoices for a client
 */
export async function getClientInvoices(
  clientId: string,
  options?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<Invoice[]> {
  const conditions = [eq(invoices.clientId, clientId)];
  
  if (options?.status) {
    conditions.push(eq(invoices.status, options.status));
  }
  
  if (options?.startDate) {
    conditions.push(gte(invoices.invoiceDate, options.startDate));
  }
  
  if (options?.endDate) {
    conditions.push(lte(invoices.invoiceDate, options.endDate));
  }
  
  return db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.invoiceDate))
    .limit(options?.limit || 50);
}

/**
 * Retry failed invoice payment
 */
export async function retryInvoicePayment(invoiceId: string): Promise<Invoice> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice) throw new Error('Invoice not found');
  if (!invoice.stripeInvoiceId) throw new Error('No Stripe invoice');
  if (invoice.status === 'paid') throw new Error('Invoice already paid');
  
  // Attempt payment in Stripe
  const stripeInvoice = await stripe.invoices.pay(invoice.stripeInvoiceId);
  
  // Sync updated invoice
  return syncInvoiceFromStripe(invoice.stripeInvoiceId);
}

/**
 * Get upcoming invoice preview
 */
export async function getUpcomingInvoice(clientId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);
  
  if (!subscription?.stripeSubscriptionId) return null;
  
  try {
    const upcoming = await stripe.invoices.retrieveUpcoming({
      subscription: subscription.stripeSubscriptionId,
    });
    
    return {
      amountDue: upcoming.amount_due,
      currency: upcoming.currency,
      periodStart: upcoming.period_start ? new Date(upcoming.period_start * 1000) : null,
      periodEnd: upcoming.period_end ? new Date(upcoming.period_end * 1000) : null,
      lineItems: upcoming.lines.data.map(line => ({
        description: line.description,
        amount: line.amount,
      })),
    };
  } catch (error) {
    return null;
  }
}
```

---

## Step 7: Create Stripe Webhook Handler

**CREATE** `src/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/clients/stripe';
import { db } from '@/lib/db';
import { subscriptions, billingEvents, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncInvoiceFromStripe } from '@/lib/services/invoices';
import { addPaymentMethod } from '@/lib/services/payment-methods';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  // Check for duplicate event
  const [existingEvent] = await db
    .select()
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  
  if (existingEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, event);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event);
        break;
        
      case 'invoice.created':
      case 'invoice.updated':
      case 'invoice.paid':
      case 'invoice.payment_failed':
        await handleInvoiceEvent(event.data.object as Stripe.Invoice, event);
        break;
        
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod, event);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialEnding(event.data.object as Stripe.Subscription, event);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling ${event.type}:`, error);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
  
  return NextResponse.json({ received: true });
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription, event: Stripe.Event) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) {
    console.error('No clientId in subscription metadata');
    return;
  }
  
  await db.update(subscriptions).set({
    status: sub.status as any,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    updatedAt: new Date(),
  }).where(eq(subscriptions.stripeSubscriptionId, sub.id));
  
  // Log event
  await logBillingEvent(clientId, event, `Subscription ${event.type.split('.')[2]}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription, event: Stripe.Event) {
  await db.update(subscriptions).set({
    status: 'canceled',
    canceledAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(subscriptions.stripeSubscriptionId, sub.id));
  
  const clientId = sub.metadata?.clientId;
  if (clientId) {
    await logBillingEvent(clientId, event, 'Subscription canceled');
    
    // Update client status
    await db.update(clients).set({
      status: 'churned',
      updatedAt: new Date(),
    }).where(eq(clients.id, clientId));
  }
}

async function handleInvoiceEvent(invoice: Stripe.Invoice, event: Stripe.Event) {
  // Sync invoice to database
  await syncInvoiceFromStripe(invoice.id);
  
  // Get client ID from subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string))
    .limit(1);
  
  if (subscription) {
    const eventType = event.type === 'invoice.paid' ? 'payment_succeeded' :
                      event.type === 'invoice.payment_failed' ? 'payment_failed' :
                      'invoice_updated';
    
    await logBillingEvent(
      subscription.clientId, 
      event, 
      `Invoice ${event.type.split('.')[1]}`,
      invoice.amount_due
    );
  }
}

async function handlePaymentMethodAttached(pm: Stripe.PaymentMethod, event: Stripe.Event) {
  // Find client by Stripe customer ID
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.stripeCustomerId, pm.customer as string))
    .limit(1);
  
  if (client) {
    await addPaymentMethod(client.id, pm.id, false);
    await logBillingEvent(client.id, event, 'Payment method added');
  }
}

async function handleTrialEnding(sub: Stripe.Subscription, event: Stripe.Event) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) return;
  
  await logBillingEvent(clientId, event, 'Trial ending in 3 days');
  
  // TODO: Send email notification about trial ending
}

async function logBillingEvent(
  clientId: string, 
  event: Stripe.Event, 
  description: string,
  amountCents?: number
) {
  await db.insert(billingEvents).values({
    clientId,
    eventType: event.type.replace(/\./g, '_'),
    description,
    stripeEventId: event.id,
    stripeEventType: event.type,
    amountCents,
    rawData: event.data.object as any,
  });
}
```

---

## Step 8: Seed Default Plans

**CREATE** `src/lib/db/seeds/plans.ts`:

```typescript
import { db } from '@/lib/db';
import { plans } from '@/lib/db/schema';

export async function seedPlans() {
  const defaultPlans = [
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Perfect for solo contractors just getting started',
      priceMonthly: 49700, // $497
      priceYearly: 497000, // $4,970 (2 months free)
      features: {
        maxLeadsPerMonth: 50,
        maxTeamMembers: 1,
        maxPhoneNumbers: 1,
        includesVoiceAi: false,
        includesCalendarSync: false,
        includesAdvancedAnalytics: false,
        includesWhiteLabel: false,
        supportLevel: 'email' as const,
        apiAccess: false,
      },
      trialDays: 14,
      displayOrder: 1,
    },
    {
      name: 'Professional',
      slug: 'professional',
      description: 'For growing businesses that need more power',
      priceMonthly: 99700, // $997
      priceYearly: 997000, // $9,970
      features: {
        maxLeadsPerMonth: 200,
        maxTeamMembers: 5,
        maxPhoneNumbers: 3,
        includesVoiceAi: true,
        includesCalendarSync: true,
        includesAdvancedAnalytics: true,
        includesWhiteLabel: false,
        supportLevel: 'priority' as const,
        apiAccess: false,
      },
      trialDays: 14,
      isPopular: true,
      displayOrder: 2,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For established businesses with high volume',
      priceMonthly: 199700, // $1,997
      priceYearly: 1997000, // $19,970
      features: {
        maxLeadsPerMonth: null, // unlimited
        maxTeamMembers: null,
        maxPhoneNumbers: 10,
        includesVoiceAi: true,
        includesCalendarSync: true,
        includesAdvancedAnalytics: true,
        includesWhiteLabel: true,
        supportLevel: 'dedicated' as const,
        apiAccess: true,
      },
      trialDays: 14,
      displayOrder: 3,
    },
  ];
  
  for (const plan of defaultPlans) {
    await db.insert(plans).values(plan).onConflictDoNothing();
  }
  
  console.log('Plans seeded successfully');
}
```

---

## Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Modified - Add billing tables |
| `src/lib/types/billing.ts` | Type exports |
| `src/lib/clients/stripe.ts` | Stripe client |
| `src/lib/services/subscription.ts` | Subscription management |
| `src/lib/services/payment-methods.ts` | Payment method management |
| `src/lib/services/invoices.ts` | Invoice management |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook handler |
| `src/lib/db/seeds/plans.ts` | Default plans |

---

## Database Tables Created

| Table | Purpose |
|-------|---------|
| `plans` | Available pricing plans |
| `subscriptions` | Client subscriptions |
| `payment_methods` | Saved payment methods |
| `invoices` | Invoice records |
| `usage_records` | Metered usage tracking |
| `billing_events` | Billing audit log |
| `coupons` | Discount codes |

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Seed plans
npx ts-node -e "require('./src/lib/db/seeds/plans').seedPlans()"

# 3. Test Stripe webhook (use Stripe CLI)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 4. Check plans
SELECT * FROM plans ORDER BY display_order;
```

---

## Success Criteria
- [ ] Plans table seeded with pricing tiers
- [ ] Subscriptions linked to Stripe
- [ ] Payment methods can be added/removed
- [ ] Invoices sync from Stripe webhooks
- [ ] Subscription status updates via webhooks
- [ ] Feature access checks working
- [ ] Usage limits enforced
