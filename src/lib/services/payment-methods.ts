import { getDb } from '@/db';
import { billingPaymentMethods, subscriptions, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import type { BillingPaymentMethod } from '@/db/schema/billing-payment-methods';

/**
 * Create a setup intent for adding a new payment method
 */
export async function createSetupIntent(clientId: string): Promise<{
  clientSecret: string;
  setupIntentId: string;
}> {
  const db = getDb();
  const stripe = getStripeClient();

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) throw new Error('Client not found');

  // Get or create Stripe customer
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

    await db.update(clients).set({ stripeCustomerId }).where(eq(clients.id, clientId));
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    metadata: { clientId },
  }, {
    idempotencyKey: `setup_intent_${clientId}_${Date.now()}`,
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
): Promise<BillingPaymentMethod> {
  const db = getDb();
  const stripe = getStripeClient();

  // Get payment method details from Stripe
  const stripePaymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

  // Check if already exists
  const [existing] = await db
    .select()
    .from(billingPaymentMethods)
    .where(eq(billingPaymentMethods.stripePaymentMethodId, stripePaymentMethodId))
    .limit(1);

  if (existing) return existing;

  // If setting as default, unset other defaults
  if (setAsDefault) {
    await db.update(billingPaymentMethods).set({
      isDefault: false,
      updatedAt: new Date(),
    }).where(eq(billingPaymentMethods.clientId, clientId));
  }

  // Check if this is the first payment method
  const existingMethods = await db
    .select()
    .from(billingPaymentMethods)
    .where(eq(billingPaymentMethods.clientId, clientId));

  const isFirstMethod = existingMethods.length === 0;

  // Create payment method record
  const [method] = await db.insert(billingPaymentMethods).values({
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
  const db = getDb();
  const stripe = getStripeClient();

  const [method] = await db
    .select()
    .from(billingPaymentMethods)
    .where(and(
      eq(billingPaymentMethods.id, paymentMethodId),
      eq(billingPaymentMethods.clientId, clientId)
    ))
    .limit(1);

  if (!method) throw new Error('Payment method not found');

  // Unset other defaults
  await db.update(billingPaymentMethods).set({
    isDefault: false,
    updatedAt: new Date(),
  }).where(eq(billingPaymentMethods.clientId, clientId));

  // Set this as default
  await db.update(billingPaymentMethods).set({
    isDefault: true,
    updatedAt: new Date(),
  }).where(eq(billingPaymentMethods.id, paymentMethodId));

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
  const db = getDb();
  const stripe = getStripeClient();

  const [method] = await db
    .select()
    .from(billingPaymentMethods)
    .where(and(
      eq(billingPaymentMethods.id, paymentMethodId),
      eq(billingPaymentMethods.clientId, clientId)
    ))
    .limit(1);

  if (!method) throw new Error('Payment method not found');
  if (method.isDefault) throw new Error('Cannot remove default payment method');

  // Detach from Stripe
  await stripe.paymentMethods.detach(method.stripePaymentMethodId);

  // Remove from database
  await db.delete(billingPaymentMethods).where(eq(billingPaymentMethods.id, paymentMethodId));
}

/**
 * Get all payment methods for a client
 */
export async function getPaymentMethods(clientId: string): Promise<BillingPaymentMethod[]> {
  const db = getDb();

  return db
    .select()
    .from(billingPaymentMethods)
    .where(eq(billingPaymentMethods.clientId, clientId))
    .orderBy(billingPaymentMethods.isDefault);
}
