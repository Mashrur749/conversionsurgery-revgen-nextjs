# Phase 18b: Payment Links (Stripe Integration)

## Prerequisites
- Phase 17a (Revenue Attribution) complete - jobs table exists
- Payment reminder flows working
- Stripe account configured

## Goal
Replace plain payment reminders with actual Stripe payment links. Enable deposits, partial payments, and payment tracking.

---

## Step 1: Configure Stripe

**ADD** to `.env.local`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Install Stripe:**
```bash
npm install stripe
```

---

## Step 2: Add Payment Tables

**MODIFY** `src/lib/db/schema.ts`:

```typescript
// ============================================
// PAYMENTS
// ============================================
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'partial',
  'overdue',
  'cancelled',
  'refunded',
]);

export const paymentTypeEnum = pgEnum('payment_type', [
  'deposit',
  'progress',
  'final',
  'full',
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  
  // Invoice details
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  description: text('description'),
  
  // Amounts (in cents)
  totalAmount: integer('total_amount').notNull(), // Total invoice amount
  paidAmount: integer('paid_amount').default(0),
  remainingAmount: integer('remaining_amount'),
  
  // Status
  status: paymentStatusEnum('status').default('pending'),
  dueDate: date('due_date'),
  
  // Stripe
  stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
  
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  
  // Payment details
  type: paymentTypeEnum('type').default('full'),
  amount: integer('amount').notNull(), // in cents
  description: text('description'),
  
  // Stripe
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 100 }),
  stripePaymentLinkId: varchar('stripe_payment_link_id', { length: 100 }),
  stripePaymentLinkUrl: varchar('stripe_payment_link_url', { length: 500 }),
  
  // Status
  status: paymentStatusEnum('status').default('pending'),
  paidAt: timestamp('paid_at'),
  
  // Link tracking
  linkSentAt: timestamp('link_sent_at'),
  linkOpenedAt: timestamp('link_opened_at'),
  linkExpiresAt: timestamp('link_expires_at'),
  
  // Metadata
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentReminders = pgTable('payment_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }),
  
  // Reminder details
  reminderNumber: integer('reminder_number').default(1),
  sentAt: timestamp('sent_at'),
  messageContent: text('message_content'),
  
  // Response tracking
  leadReplied: boolean('lead_replied').default(false),
  replyContent: text('reply_content'),
  
  createdAt: timestamp('created_at').defaultNow(),
});
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 3: Create Stripe Service

**CREATE** `src/lib/services/stripe.ts`:

```typescript
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { payments, invoices, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

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
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  
  if (lead?.stripeCustomerId) {
    return lead.stripeCustomerId;
  }
  
  // Create new customer
  const customer = await stripe.customers.create({
    email,
    phone,
    name: name || lead?.name,
    metadata: {
      leadId,
      source: 'conversionsurgery',
    },
  });
  
  // Save to lead
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
    customerEmail,
    customerPhone,
    metadata = {},
  } = input;
  
  // Create Stripe price (one-time)
  const price = await stripe.prices.create({
    unit_amount: amount,
    currency: 'usd',
    product_data: {
      name: description,
    },
  });
  
  // Create payment link
  const paymentLink = await stripe.paymentLinks.create({
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
    // Allow customer to enter email/phone
    phone_number_collection: { enabled: true },
    // Collect billing address
    billing_address_collection: 'auto',
  });
  
  // Save payment record
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
export async function createInvoice(input: {
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
  
  // Create invoice record
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
  
  // Create payment link for full amount
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
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice) throw new Error('Invoice not found');
  
  const depositAmount = Math.round(invoice.totalAmount * (depositPercent / 100));
  
  const { paymentLinkUrl } = await createPaymentLink({
    clientId: invoice.clientId!,
    leadId: invoice.leadId!,
    invoiceId,
    amount: depositAmount,
    description: `${depositPercent}% Deposit - ${invoice.description}`,
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
  // Find payment record
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentLinkId, paymentLinkId))
    .limit(1);
  
  if (!payment) {
    console.error('Payment not found for link:', paymentLinkId);
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
    
    if (invoice) {
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
  }
  
  // Update job revenue attribution if exists
  if (payment.invoiceId) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, payment.invoiceId))
      .limit(1);
    
    if (invoice?.jobId) {
      // This integrates with Phase 17a revenue attribution
      await db.execute(
        `UPDATE jobs SET actual_revenue = actual_revenue + ${amountPaid} WHERE id = '${invoice.jobId}'`
      );
    }
  }
}

/**
 * Format amount for display
 */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
```

---

## Step 4: Create Stripe Webhook

**CREATE** `src/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handlePaymentSuccess } from '@/lib/services/stripe';
import { db } from '@/lib/db';
import { payments, leads, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

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
        if (leadId) {
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);
          
          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, session.metadata?.clientId || ''))
            .limit(1);
          
          if (lead && client) {
            const amount = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format((session.amount_total || 0) / 100);
            
            await sendSMS({
              to: lead.phone,
              from: client.twilioPhoneNumber!,
              body: `✅ Payment of ${amount} received! Thank you for your business. - ${client.businessName}`,
            });
          }
        }
        
        // Notify client owner
        if (session.metadata?.clientId) {
          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, session.metadata.clientId))
            .limit(1);
          
          if (client?.ownerPhone) {
            const amount = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format((session.amount_total || 0) / 100);
            
            // Use admin Twilio number to notify client
            await sendSMS({
              to: client.ownerPhone,
              from: process.env.TWILIO_PHONE_NUMBER!,
              body: `💰 Payment received: ${amount} from ${session.customer_details?.name || 'customer'}`,
            });
          }
        }
      }
      break;
    }
    
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Mark payment as expired
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
```

---

## Step 5: Create Payment API Routes

**CREATE** `src/app/api/payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createPaymentLink, createInvoice } from '@/lib/services/stripe';
import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET - List payments for a client
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const leadId = searchParams.get('leadId');

  const conditions = [];
  if (clientId) conditions.push(eq(payments.clientId, clientId));
  if (leadId) conditions.push(eq(payments.leadId, leadId));

  const results = await db
    .select()
    .from(payments)
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(100);

  return NextResponse.json(results);
}

// POST - Create new payment link
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    clientId,
    leadId,
    amount, // in dollars, will convert to cents
    description,
    type = 'full',
    createInvoice: shouldCreateInvoice = false,
    dueDate,
  } = body;

  if (!clientId || !leadId || !amount) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  const amountCents = Math.round(amount * 100);

  if (shouldCreateInvoice) {
    const result = await createInvoice({
      clientId,
      leadId,
      totalAmount: amountCents,
      description: description || 'Service payment',
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    
    return NextResponse.json(result);
  }

  const result = await createPaymentLink({
    clientId,
    leadId,
    amount: amountCents,
    description: description || 'Payment',
    type,
  });

  return NextResponse.json(result);
}
```

**CREATE** `src/app/api/payments/[id]/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { payments, leads, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { generatePaymentMessage, formatAmount } from '@/lib/services/stripe';

// POST - Send payment link via SMS
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, params.id))
    .limit(1);

  if (!payment || !payment.stripePaymentLinkUrl) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, payment.leadId!))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.clientId, payment.clientId!))
    .limit(1);

  if (!lead || !client) {
    return NextResponse.json({ error: 'Lead or client not found' }, { status: 404 });
  }

  // Generate and send message
  const message = generatePaymentMessage(
    payment.amount,
    payment.stripePaymentLinkUrl
  );

  await sendSMS({
    to: lead.phone,
    from: client.twilioPhoneNumber!,
    body: message,
  });

  // Update sent timestamp
  await db
    .update(payments)
    .set({ linkSentAt: new Date() })
    .where(eq(payments.id, params.id));

  return NextResponse.json({ success: true, message });
}
```

---

## Step 6: Update Payment Reminder Flow

**MODIFY** the payment reminder sequence to use payment links:

**UPDATE** `src/lib/services/sequences.ts`:

```typescript
import { createPaymentLink, formatAmount } from './stripe';

// In the payment reminder execution:
async function executePaymentReminder(lead: Lead, client: Client, invoiceId: string) {
  // Get or create payment link
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice) return;
  
  // Check if we have an existing payment link
  let paymentUrl = '';
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.status, 'pending')
      )
    )
    .limit(1);
  
  if (existingPayment?.stripePaymentLinkUrl) {
    paymentUrl = existingPayment.stripePaymentLinkUrl;
  } else {
    // Create new payment link
    const result = await createPaymentLink({
      clientId: client.id,
      leadId: lead.id,
      invoiceId,
      amount: invoice.remainingAmount || invoice.totalAmount,
      description: invoice.description || 'Payment due',
      type: invoice.paidAmount > 0 ? 'final' : 'full',
    });
    paymentUrl = result.paymentLinkUrl;
  }
  
  // Calculate days overdue
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const daysOverdue = dueDate
    ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Generate message with payment link
  const amount = formatAmount(invoice.remainingAmount || invoice.totalAmount);
  let message: string;
  
  if (daysOverdue > 14) {
    message = `Final notice: Your balance of ${amount} is ${daysOverdue} days overdue. Please pay now to avoid additional action: ${paymentUrl}`;
  } else if (daysOverdue > 7) {
    message = `Reminder: Your balance of ${amount} is past due. Pay securely here: ${paymentUrl}`;
  } else if (daysOverdue > 0) {
    message = `Hi! Just a reminder that your balance of ${amount} is due. Pay easily here: ${paymentUrl}`;
  } else {
    message = `Hi! Your invoice of ${amount} is ready. Pay securely here: ${paymentUrl}`;
  }
  
  await sendSMS({
    to: lead.phone,
    from: client.twilioPhoneNumber!,
    body: message,
  });
  
  // Record reminder
  await db.insert(paymentReminders).values({
    invoiceId,
    paymentId: existingPayment?.id,
    reminderNumber: /* calculate */,
    sentAt: new Date(),
    messageContent: message,
  });
}
```

---

## Step 7: Payment Button Component

**CREATE** `src/components/payments/send-payment-button.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Send, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SendPaymentButtonProps {
  leadId: string;
  clientId: string;
  leadName: string;
  defaultAmount?: number;
}

export function SendPaymentButton({
  leadId,
  clientId,
  leadName,
  defaultAmount,
}: SendPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(defaultAmount?.toString() || '');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('full');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const createPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          leadId,
          amount: parseFloat(amount),
          description: description || `Payment from ${leadName}`,
          type,
        }),
      });

      const data = await res.json();
      if (data.paymentLinkUrl) {
        setPaymentUrl(data.paymentLinkUrl);
        toast.success('Payment link created!');
      } else {
        throw new Error(data.error || 'Failed to create payment');
      }
    } catch (err) {
      toast.error('Failed to create payment link');
    } finally {
      setLoading(false);
    }
  };

  const sendPaymentSMS = async () => {
    setLoading(true);
    try {
      // First create payment if not exists
      if (!paymentUrl) {
        await createPayment();
      }

      // Then send SMS
      const res = await fetch(`/api/payments/${paymentUrl}/send`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Payment link sent via SMS!');
        setOpen(false);
      } else {
        throw new Error('Failed to send');
      }
    } catch (err) {
      toast.error('Failed to send payment link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="h-4 w-4 mr-1" />
          Send Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Payment Request to {leadName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What is this payment for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Payment</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="progress">Progress Payment</SelectItem>
                <SelectItem value="final">Final Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentUrl && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <Label className="text-xs text-muted-foreground">
                Payment Link Created
              </Label>
              <div className="flex gap-2">
                <Input value={paymentUrl} readOnly className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {!paymentUrl ? (
              <Button
                onClick={createPayment}
                disabled={loading || !amount}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Create Payment Link
              </Button>
            ) : (
              <Button
                onClick={sendPaymentSMS}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send via SMS
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Step 8: Payment Success Page

**CREATE** `src/app/payment/success/page.tsx`:

```typescript
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Thank you for your payment. You should receive a confirmation text
            shortly.
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this window now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 9: Add stripeCustomerId to Leads

**MODIFY** `src/lib/db/schema.ts` - ADD to leads table:

```typescript
// In leads table, ADD:
stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
```

Run migration.

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add payments tables |
| `src/lib/services/stripe.ts` | Created |
| `src/app/api/webhooks/stripe/route.ts` | Created |
| `src/app/api/payments/route.ts` | Created |
| `src/app/api/payments/[id]/send/route.ts` | Created |
| `src/lib/services/sequences.ts` | Modified |
| `src/components/payments/send-payment-button.tsx` | Created |
| `src/app/payment/success/page.tsx` | Created |

---

## Stripe Dashboard Setup

1. Create Stripe account at stripe.com
2. Enable Payment Links in Dashboard
3. Add webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
4. Select events: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`
5. Copy webhook secret to `.env.local`

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Test payment link creation
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{"clientId": "...", "leadId": "...", "amount": 500, "description": "Test payment"}'

# 3. Test Stripe webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 4. Make test payment through Stripe
# Use card 4242424242424242

# 5. Verify payment recorded in database
```

## Success Criteria
- [ ] Payment links created via Stripe API
- [ ] SMS sent with payment link
- [ ] Webhook receives payment confirmation
- [ ] Payment status updated in database
- [ ] Lead receives confirmation SMS
- [ ] Client notified of payment
- [ ] Revenue attribution updated
