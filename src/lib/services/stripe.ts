import Stripe from 'stripe';
import { getDb } from '@/db';
import { payments, invoices, leads } from '@/db/schema';
import { eq } from 'drizzle-orm';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return _stripe;
}

interface CreatePaymentLinkInput {
  clientId: string;
  leadId: string;
  invoiceId?: string;
  amount: number; // in cents
  description: string;
  type?: 'deposit' | 'progress' | 'final' | 'full';
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
}

/**
 * Create or get Stripe customer for a lead
 */
export async function getOrCreateStripeCustomer(
  leadId: string,
  email?: string,
  phone?: string,
  name?: string
): Promise<string> {
  const db = getDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (lead?.stripeCustomerId) {
    return lead.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    email,
    phone,
    name: name || lead?.name || undefined,
    metadata: {
      leadId,
      source: 'conversionsurgery',
    },
  });

  await db
    .update(leads)
    .set({ stripeCustomerId: customer.id })
    .where(eq(leads.id, leadId));

  return customer.id;
}

/**
 * Create a payment link for a specific amount
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<{
  paymentId: string;
  paymentLinkUrl: string;
  paymentLinkId: string;
}> {
  const {
    clientId,
    leadId,
    invoiceId,
    amount,
    description,
    type = 'full',
    metadata = {},
  } = input;

  // Create Stripe price (one-time)
  const price = await getStripe().prices.create({
    unit_amount: amount,
    currency: 'cad',
    product_data: {
      name: description,
    },
  });

  // Create payment link
  const paymentLink = await getStripe().paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      clientId,
      leadId,
      invoiceId: invoiceId || '',
      type,
      ...metadata,
    },
    after_completion: {
      type: 'redirect',
      redirect: {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      },
    },
    phone_number_collection: { enabled: true },
    billing_address_collection: 'auto',
  });

  // Save payment record
  const db = getDb();
  const [payment] = await db
    .insert(payments)
    .values({
      clientId,
      leadId,
      invoiceId,
      type,
      amount,
      description,
      stripePaymentLinkId: paymentLink.id,
      stripePaymentLinkUrl: paymentLink.url,
      status: 'pending',
      linkExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    })
    .returning();

  return {
    paymentId: payment.id,
    paymentLinkUrl: paymentLink.url,
    paymentLinkId: paymentLink.id,
  };
}

/**
 * Create an invoice with payment link
 */
export async function createInvoiceWithLink(input: {
  clientId: string;
  leadId: string;
  jobId?: string;
  totalAmount: number;
  description: string;
  dueDate?: Date;
  invoiceNumber?: string;
}): Promise<{
  invoiceId: string;
  paymentLinkUrl: string;
}> {
  const {
    clientId,
    leadId,
    jobId,
    totalAmount,
    description,
    dueDate,
    invoiceNumber,
  } = input;

  const db = getDb();
  const [invoice] = await db
    .insert(invoices)
    .values({
      clientId,
      leadId,
      jobId,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      description,
      totalAmount,
      remainingAmount: totalAmount,
      status: 'pending',
      dueDate: dueDate?.toISOString().split('T')[0],
    })
    .returning();

  const { paymentLinkUrl } = await createPaymentLink({
    clientId,
    leadId,
    invoiceId: invoice.id,
    amount: totalAmount,
    description,
    type: 'full',
  });

  return {
    invoiceId: invoice.id,
    paymentLinkUrl,
  };
}

/**
 * Create deposit payment link (percentage of total)
 */
export async function createDepositLink(
  invoiceId: string,
  depositPercent: number = 50
): Promise<{ paymentLinkUrl: string }> {
  const db = getDb();
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) throw new Error('Invoice not found');
  if (!invoice.totalAmount) throw new Error('Invoice has no total amount');

  const depositAmount = Math.round(invoice.totalAmount * (depositPercent / 100));

  const { paymentLinkUrl } = await createPaymentLink({
    clientId: invoice.clientId,
    leadId: invoice.leadId,
    invoiceId,
    amount: depositAmount,
    description: `${depositPercent}% Deposit - ${invoice.description || 'Invoice'}`,
    type: 'deposit',
  });

  return { paymentLinkUrl };
}

/**
 * Handle successful payment (called from webhook)
 */
export async function handlePaymentSuccess(
  paymentLinkId: string,
  paymentIntentId: string,
  amountPaid: number
): Promise<void> {
  const db = getDb();

  // Find payment record
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentLinkId, paymentLinkId))
    .limit(1);

  if (!payment) {
    console.error('[Stripe] Payment not found for link:', paymentLinkId);
    return;
  }

  // Update payment status
  await db
    .update(payments)
    .set({
      status: 'paid',
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    })
    .where(eq(payments.id, payment.id));

  // Update invoice if exists
  if (payment.invoiceId) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, payment.invoiceId))
      .limit(1);

    if (invoice && invoice.totalAmount) {
      const newPaidAmount = (invoice.paidAmount || 0) + amountPaid;
      const newRemaining = invoice.totalAmount - newPaidAmount;

      await db
        .update(invoices)
        .set({
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          status: newRemaining <= 0 ? 'paid' : 'partial',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, payment.invoiceId));
    }

    // Update job revenue attribution if exists
    if (invoice?.jobId) {
      const { jobs } = await import('@/db/schema');
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, invoice.jobId))
        .limit(1);

      if (job) {
        await db
          .update(jobs)
          .set({ paidAmount: (job.paidAmount || 0) + amountPaid })
          .where(eq(jobs.id, invoice.jobId));
      }
    }
  }
}

/**
 * Format amount for display
 */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100);
}

/**
 * Generate payment reminder message with link
 */
export function generatePaymentMessage(
  amount: number,
  paymentUrl: string,
  daysOverdue?: number
): string {
  const formattedAmount = formatAmount(amount);

  if (daysOverdue && daysOverdue > 0) {
    return `Hi! Your balance of ${formattedAmount} was due ${daysOverdue} days ago. Pay securely here: ${paymentUrl}`;
  }

  return `Hi! Your balance of ${formattedAmount} is ready. Pay securely here: ${paymentUrl}`;
}
