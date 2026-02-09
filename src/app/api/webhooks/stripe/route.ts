import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handlePaymentSuccess, formatAmount } from '@/lib/services/stripe';
import { getDb } from '@/db';
import { payments, leads, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return _stripe;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_link && session.payment_intent) {
        await handlePaymentSuccess(
          session.payment_link as string,
          session.payment_intent as string,
          session.amount_total || 0
        );

        // Send confirmation to lead
        const leadId = session.metadata?.leadId;
        const clientId = session.metadata?.clientId;

        if (leadId && clientId) {
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);

          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);

          if (lead && client && client.twilioNumber) {
            const amount = formatAmount(session.amount_total || 0);

            await sendSMS(
              lead.phone,
              client.twilioNumber,
              `Payment of ${amount} received! Thank you for your business. - ${client.businessName}`
            );
          }

          // Notify client owner
          if (client?.phone) {
            const amount = formatAmount(session.amount_total || 0);
            const adminNumber = process.env.TWILIO_PHONE_NUMBER;

            if (adminNumber) {
              await sendSMS(
                client.phone,
                adminNumber,
                `Payment received: ${amount} from ${session.customer_details?.name || 'customer'}`
              );
            }
          }
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_link) {
        await db
          .update(payments)
          .set({ status: 'cancelled' })
          .where(eq(payments.stripePaymentLinkId, session.payment_link as string));
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;

      if (charge.payment_intent) {
        await db
          .update(payments)
          .set({ status: 'refunded' })
          .where(eq(payments.stripePaymentIntentId, charge.payment_intent as string));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
