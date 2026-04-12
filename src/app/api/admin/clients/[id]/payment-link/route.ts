import { z } from 'zod';
import { getDb } from '@/db';
import { clients, plans, subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { sendAlert } from '@/lib/services/agency-communication';
import { sendEmail } from '@/lib/services/resend';

const paymentLinkSchema = z.object({
  planId: z.string().uuid(),
}).strict();

/** POST /api/admin/clients/[id]/payment-link — Operator sends payment link to contractor */
export const POST = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.BILLING_MANAGE,
    clientIdFrom: (p) => p.id,
  },
  async ({ request, clientId }) => {
    const body = await request.json();
    const { planId } = paymentLinkSchema.parse(body);

    const db = getDb();
    const stripe = getStripeClient();

    // Load client
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check for existing active subscription — already has one
    const [existingSub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.clientId, clientId))
      .limit(1);

    if (existingSub) {
      return Response.json(
        { error: 'Client already has an active subscription.' },
        { status: 409 }
      );
    }

    // Load plan
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan || !plan.isActive) {
      return Response.json({ error: 'Plan not found or inactive' }, { status: 404 });
    }

    const priceId = plan.stripePriceIdMonthly;
    if (!priceId || !priceId.startsWith('price_')) {
      return Response.json(
        { error: 'Stripe pricing not configured for this plan. Contact support.' },
        { status: 422 }
      );
    }

    // Create or get Stripe customer
    let stripeCustomerId = client.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: client.email || undefined,
          name: client.businessName,
          metadata: { clientId },
        },
        { idempotencyKey: `cust_create_${clientId}` }
      );
      stripeCustomerId = customer.id;

      await db
        .update(clients)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(clients.id, clientId));
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

    // Create Stripe Checkout Session with Terms of Service
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: plan.trialDays ?? 30,
        metadata: { clientId, planId },
      },
      consent_collection: {
        terms_of_service: 'required',
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: 'I agree to the [Terms of Service](https://app.conversionsurgery.com/terms)',
        },
      },
      success_url: `${appUrl}/client/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/client/billing`,
      metadata: { clientId, planId, flow: 'operator_payment_link' },
    });

    if (!session.url) {
      return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    const checkoutUrl = session.url;

    // Send SMS alert to contractor
    if (client.phone) {
      await sendAlert({
        clientId,
        message: `Set up payment for ${client.businessName}: ${checkoutUrl}`,
      });
    }

    // Send email to contractor
    if (client.email) {
      await sendEmail({
        to: client.email,
        subject: `Complete your ConversionSurgery subscription — ${client.businessName}`,
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B2F26;">Set Up Your Subscription</h2>
            <p>Hi ${client.ownerName},</p>
            <p>Your ConversionSurgery account for <strong>${client.businessName}</strong> is ready. Complete your subscription setup to activate all features.</p>
            <p><strong>Plan:</strong> ${plan.name}</p>
            <a href="${checkoutUrl}" style="display: inline-block; background: #6B7E54; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: 600;">Complete Payment Setup</a>
            <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">If you did not request this, please ignore this email or contact us for help.</p>
          </div>
        `,
      });
    }

    return Response.json({ success: true, url: checkoutUrl });
  }
);
