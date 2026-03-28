import { z } from 'zod';
import Stripe from 'stripe';
import { getDb } from '@/db';
import { plans, clients, subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { validateCoupon } from '@/lib/services/coupon-validation';

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'yearly']),
  couponCode: z.string().optional(),
}).strict();

/** POST /api/client/billing/checkout — Create Stripe Checkout Session for new subscription */
export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ session, request }) => {
    const body = await request.json();
    const { planId, billingCycle, couponCode } = checkoutSchema.parse(body);

    const db = getDb();
    const stripe = getStripeClient();
    const clientId = session.clientId;

    // Load plan
    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan || !plan.isActive) {
      return Response.json({ error: 'Plan not found or inactive' }, { status: 404 });
    }

    // Resolve price ID
    const priceId = billingCycle === 'yearly'
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly;

    if (!priceId || !priceId.startsWith('price_')) {
      return Response.json(
        { error: 'Stripe pricing not configured for this plan. Contact support.' },
        { status: 422 }
      );
    }

    // Check for existing active subscription — use changePlan flow instead
    const [existingSub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.clientId, clientId))
      .limit(1);

    if (existingSub) {
      return Response.json(
        { error: 'You already have a subscription. Use the plan change option instead.' },
        { status: 409 }
      );
    }

    // Load client
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Create or get Stripe customer
    let stripeCustomerId = client.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: client.email || undefined,
        name: client.businessName,
        metadata: { clientId },
      }, {
        idempotencyKey: `cust_create_${clientId}`,
      });
      stripeCustomerId = customer.id;

      await db.update(clients).set({
        stripeCustomerId,
        updatedAt: new Date(),
      }).where(eq(clients.id, clientId));
    }

    // Check trial eligibility (prevent trial abuse — B4)
    let trialDays = plan.trialDays || undefined;
    if (trialDays) {
      const [priorSub] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.clientId, clientId))
        .limit(1);
      if (priorSub) {
        trialDays = undefined;
      }
    }

    // Validate coupon (read-only — actual redemption happens in webhook)
    let stripeCouponId: string | undefined;
    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, planId, clientId);
      if (!couponResult.valid) {
        return Response.json({ error: couponResult.error || 'Invalid coupon' }, { status: 400 });
      }
      stripeCouponId = couponCode.toUpperCase();
    }

    // Build Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          clientId,
          planId,
          couponCode: couponCode?.toUpperCase() || '',
        },
      },
      success_url: `${appUrl}/client/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/client/billing/upgrade`,
      metadata: {
        clientId,
        planId,
        flow: 'subscription_checkout',
      },
    };

    if (stripeCouponId) {
      params.discounts = [{ coupon: stripeCouponId }];
    }

    const checkoutSession = await stripe.checkout.sessions.create(params);

    return Response.json({ url: checkoutSession.url });
  }
);
