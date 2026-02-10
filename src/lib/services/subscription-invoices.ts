import { getDb } from '@/db';
import { subscriptionInvoices, subscriptions } from '@/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import type { SubscriptionInvoice } from '@/db/schema/subscription-invoices';

/**
 * Sync invoice from Stripe
 */
export async function syncInvoiceFromStripe(stripeInvoiceId: string): Promise<SubscriptionInvoice> {
  const db = getDb();
  const stripe = getStripeClient();

  const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);

  // In Stripe v20, subscription ID is in parent.subscription_details.subscription
  const stripeSubId = typeof stripeInvoice.parent?.subscription_details?.subscription === 'string'
    ? stripeInvoice.parent.subscription_details.subscription
    : stripeInvoice.parent?.subscription_details?.subscription?.id;

  if (!stripeSubId) throw new Error('No subscription found on invoice');

  // Find client from subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
    .limit(1);

  if (!subscription) throw new Error('Subscription not found for invoice');

  // Map line items (adapted for Stripe v20 types)
  const lineItems = stripeInvoice.lines.data.map(line => ({
    description: line.description || '',
    quantity: line.quantity || 1,
    unitAmountCents: line.pricing?.unit_amount_decimal
      ? Math.round(parseFloat(line.pricing.unit_amount_decimal))
      : 0,
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
    stripePaymentIntentId: undefined as string | undefined,
    invoiceNumber: stripeInvoice.number,
    status: stripeInvoice.status || 'draft',
    subtotalCents: stripeInvoice.subtotal,
    discountCents: stripeInvoice.total_discount_amounts?.reduce((sum, d) => sum + d.amount, 0) || 0,
    taxCents: stripeInvoice.total_taxes?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
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
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(subscriptionInvoices)
      .set(invoiceData)
      .where(eq(subscriptionInvoices.id, existing.id))
      .returning();
    return updated;
  } else {
    const [created] = await db.insert(subscriptionInvoices).values(invoiceData).returning();
    return created;
  }
}

/**
 * Get invoices for a client
 */
export async function getClientSubscriptionInvoices(
  clientId: string,
  options?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<SubscriptionInvoice[]> {
  const db = getDb();
  const conditions = [eq(subscriptionInvoices.clientId, clientId)];

  if (options?.status) {
    conditions.push(eq(subscriptionInvoices.status, options.status));
  }

  if (options?.startDate) {
    conditions.push(gte(subscriptionInvoices.invoiceDate, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lte(subscriptionInvoices.invoiceDate, options.endDate));
  }

  return db
    .select()
    .from(subscriptionInvoices)
    .where(and(...conditions))
    .orderBy(desc(subscriptionInvoices.invoiceDate))
    .limit(options?.limit || 50);
}

/**
 * Retry failed invoice payment
 */
export async function retryInvoicePayment(invoiceId: string): Promise<SubscriptionInvoice> {
  const db = getDb();
  const stripe = getStripeClient();

  const [invoice] = await db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.id, invoiceId))
    .limit(1);

  if (!invoice) throw new Error('Invoice not found');
  if (!invoice.stripeInvoiceId) throw new Error('No Stripe invoice');
  if (invoice.status === 'paid') throw new Error('Invoice already paid');

  // Attempt payment in Stripe
  await stripe.invoices.pay(invoice.stripeInvoiceId);

  // Sync updated invoice
  return syncInvoiceFromStripe(invoice.stripeInvoiceId);
}

/**
 * Get upcoming invoice preview
 */
export async function getUpcomingInvoice(clientId: string) {
  const db = getDb();
  const stripe = getStripeClient();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  if (!subscription?.stripeSubscriptionId) return null;

  try {
    // Stripe v20 uses createPreview instead of retrieveUpcoming
    const upcoming = await stripe.invoices.createPreview({
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
  } catch {
    return null;
  }
}
