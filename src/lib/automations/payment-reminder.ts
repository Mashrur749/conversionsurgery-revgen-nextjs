import { getDb } from '@/db';
import { clients, leads, invoices, scheduledMessages, payments, paymentReminders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays, isFuture, isToday } from 'date-fns';
import { createPaymentLink } from '@/lib/services/stripe';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { sendEmail } from '@/lib/services/resend';

interface PaymentPayload {
  leadId: string;
  clientId: string;
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;      // YYYY-MM-DD
  paymentLink?: string;
  milestoneType?: 'standard' | 'deposit' | 'progress' | 'final';
  parentInvoiceId?: string;
  jobId?: string;
}

interface CreatePaymentLinkParams {
  clientId: string;
  leadId: string;
  invoiceId: string;
  amount: number;
  description: string;
  type?: 'deposit' | 'progress' | 'final' | 'full';
}

interface CreatePaymentLinkResult {
  paymentLinkUrl: string;
}

const PAYMENT_SCHEDULE = [
  { daysFromDue: 0, template: 'payment_due', step: 1 },
  { daysFromDue: 3, template: 'payment_day_3', step: 2 },
  { daysFromDue: 7, template: 'payment_day_7', step: 3 },
  { daysFromDue: 14, template: 'payment_day_14', step: 4 },
];

/**
 * Returns a UTC Date representing 10:00am in the client's local timezone
 * on the given calendar date.
 *
 * Uses the Intl API (no external dependency) — same approach as no-show-recovery.ts.
 */
function tenAmInTimezone(date: Date, timezone: string): Date {
  // Get the calendar date string in the client's timezone (YYYY-MM-DD)
  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const [year, month, day] = localDateStr.split('-').map(Number);

  // Candidate: 10:00 UTC on that calendar date
  const candidateUtc = new Date(Date.UTC(year, month - 1, day, 10, 0, 0, 0));

  // Determine what local hour that candidate falls on
  const localHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(candidateUtc);
  const localHour = Number(localHourStr);

  // Shift to align candidate with 10:00 local
  const offsetMs = (10 - localHour) * 60 * 60 * 1000;
  return new Date(candidateUtc.getTime() + offsetMs);
}

/**
 * Starts a payment reminder sequence for a client's invoice.
 * Creates invoice record, generates Stripe payment link if needed, and schedules reminder messages.
 * @param payload - Payment details including lead, client, amount, and due date
 * @returns Success status, invoice ID, payment link, and scheduled message IDs
 */
export async function startPaymentReminder(payload: PaymentPayload) {
  console.log('[Payments] Starting payment reminder sequence', { leadId: payload.leadId, clientId: payload.clientId });
  const db = getDb();
  const { leadId, clientId, invoiceNumber, amount, dueDate, paymentLink, milestoneType, parentInvoiceId, jobId } = payload;

  // 1. Get client and lead
  const clientResult = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

  if (!clientResult.length || !leadResult.length) {
    return { success: false, reason: 'Client or lead not found' };
  }

  const client = clientResult[0];
  const lead = leadResult[0];

  // 2. Create invoice record
  const amountCents = amount ? Math.round(amount * 100) : undefined;
  const invoiceCreated = await db
    .insert(invoices)
    .values({
      leadId,
      clientId,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      amount: amount ? String(amount) : null,
      totalAmount: amountCents,
      remainingAmount: amountCents,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      paymentLink,
      status: 'pending',
      ...(milestoneType && { milestoneType }),
      ...(parentInvoiceId && { parentInvoiceId }),
      ...(jobId && { jobId }),
    })
    .returning();

  const invoice = invoiceCreated[0];

  // 3. Auto-create Stripe payment link if not provided and amount is set
  // Retry up to 3 times with exponential backoff (500ms, 1000ms) on transient Stripe errors.
  let resolvedPaymentLink = paymentLink;
  let paymentLinkFailed = false;
  if (!resolvedPaymentLink && amountCents && amountCents > 0) {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [500, 1000];
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await createPaymentLink({
          clientId,
          leadId,
          invoiceId: invoice.id,
          amount: amountCents,
          description: `Invoice ${invoice.invoiceNumber || ''} - ${client.businessName}`.trim(),
          type: 'full',
        } as CreatePaymentLinkParams) as CreatePaymentLinkResult;
        resolvedPaymentLink = result.paymentLinkUrl;

        // Update invoice with the payment link
        await db
          .update(invoices)
          .set({ paymentLink: resolvedPaymentLink })
          .where(eq(invoices.id, invoice.id));

        lastError = undefined;
        break; // success — exit retry loop
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
        }
      }
    }

    if (lastError !== undefined) {
      logSanitizedConsoleError(
        '[Payments] Failed to create Stripe payment link after 3 attempts',
        lastError instanceof Error ? lastError : new Error(String(lastError)),
        { invoiceNumber: invoice.invoiceNumber, clientId, leadId }
      );
      paymentLinkFailed = true;

      // Alert operator so they can share the payment link manually
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `Payment link creation failed — invoice ${invoice.invoiceNumber || invoice.id} for ${client.businessName}`,
          html: `<p>Stripe payment link creation failed after 3 attempts for the following invoice. The payment reminder sequence has started using a fallback message (&ldquo;Contact us to arrange payment&rdquo;).</p>
<p><strong>Invoice:</strong> ${invoice.invoiceNumber || invoice.id}</p>
<p><strong>Client:</strong> ${client.businessName}</p>
<p><strong>Amount:</strong> $${(amountCents / 100).toFixed(2)}</p>
<p><strong>Lead ID:</strong> ${leadId}</p>
<p>Please create a payment link manually in Stripe and share it with the customer directly, or update the invoice record in the admin dashboard.</p>`,
        }).catch(() => {
          // Email failure must not block the reminder sequence
        });
      }
    }
  }

  // 4. Cancel existing payment sequences
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'New payment sequence started',
    })
    .where(and(
      eq(scheduledMessages.leadId, leadId),
      eq(scheduledMessages.sequenceType, 'payment_reminder'),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // 5. Schedule reminders
  const dueDateObj = dueDate ? new Date(dueDate + 'T00:00:00') : new Date();
  const scheduledIds: string[] = [];

  // Use client's timezone for scheduling — fall back to Alberta default if not set
  const clientTimezone = client.timezone || 'America/Edmonton';

  for (const item of PAYMENT_SCHEDULE) {
    const targetDate = addDays(dueDateObj, item.daysFromDue);
    const sendAt = tenAmInTimezone(targetDate, clientTimezone);

    // Skip past dates (except day 0 if it's today)
    const shouldSchedule = isFuture(sendAt) || (item.daysFromDue === 0 && isToday(dueDateObj));
    if (!shouldSchedule) continue;

    const paymentLinkText = paymentLinkFailed
      ? 'Contact us to arrange payment'
      : (resolvedPaymentLink || '[payment link]');

    const content = renderTemplate(item.template, {
      name: lead.name || 'there',
      invoiceNumber: invoice.invoiceNumber || '',
      amount: amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00',
      currencySymbol: '$',
      paymentLink: paymentLinkText,
      ownerName: client.ownerName,
      businessName: client.businessName,
      businessPhone: client.phone,
    });

    const scheduled = await db
      .insert(scheduledMessages)
      .values({
        leadId,
        clientId,
        sequenceType: 'payment_reminder',
        sequenceStep: item.step,
        content,
        sendAt,
      })
      .returning();

    scheduledIds.push(scheduled[0].id);

    // Record in payment_reminders table for tracking
    await db.insert(paymentReminders).values({
      invoiceId: invoice.id,
      reminderNumber: item.step,
      sentAt: sendAt,
      messageContent: content,
    });
  }

  return {
    success: true,
    invoiceId: invoice.id,
    paymentLink: resolvedPaymentLink,
    scheduledCount: scheduledIds.length,
    scheduledIds,
  };
}

/**
 * Marks an invoice as paid and cancels any remaining payment reminders.
 * Also updates associated pending payments to paid status.
 * If the invoice is a deposit, automatically creates and starts a final invoice sequence.
 * @param invoiceId - The invoice ID to mark as paid
 * @returns Success status, plus finalInvoiceId if a final invoice was automatically created
 */
export async function markInvoicePaid(invoiceId: string, options?: {
  paymentMethod?: string;
  notes?: string;
  paidAt?: Date;
  recordedBy?: string;
}): Promise<{ success: boolean; finalInvoiceId?: string }> {
  console.log('[Payments] Marking invoice as paid', { invoiceId, paymentMethod: options?.paymentMethod });
  const db = getDb();

  // Mark invoice as paid
  await db
    .update(invoices)
    .set({
      status: 'paid',
      updatedAt: new Date(),
      ...(options?.paidAt && { paidAt: options.paidAt }),
    })
    .where(eq(invoices.id, invoiceId));

  // Get invoice to find lead
  const invoiceResult = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  let finalInvoiceId: string | undefined;

  if (invoiceResult.length && invoiceResult[0].leadId) {
    const invoice = invoiceResult[0];

    // Cancel remaining payment reminders
    await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Invoice paid',
      })
      .where(and(
        eq(scheduledMessages.leadId, invoice.leadId),
        eq(scheduledMessages.sequenceType, 'payment_reminder'),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      ));

    // Also mark any pending payments as paid
    await db
      .update(payments)
      .set({ status: 'paid', paidAt: new Date() })
      .where(and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.status, 'pending')
      ));

    // Deposit → final chain: auto-create final invoice and start reminders when deposit is paid
    if (invoice.milestoneType === 'deposit') {
      try {
        const { createFinalInvoice } = await import('@/lib/services/revenue');
        finalInvoiceId = await createFinalInvoice(invoiceId);

        // Fetch final invoice to get computed remaining amount
        const finalInvoiceResult = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, finalInvoiceId))
          .limit(1);

        if (finalInvoiceResult.length) {
          const finalInvoice = finalInvoiceResult[0];
          const finalAmountDollars = finalInvoice.totalAmount
            ? finalInvoice.totalAmount / 100
            : undefined;

          // Start payment reminder sequence — this will schedule SMS reminders for the balance
          await startPaymentReminder({
            leadId: invoice.leadId,
            clientId: invoice.clientId,
            amount: finalAmountDollars,
            milestoneType: 'final',
            parentInvoiceId: invoiceId,
            jobId: invoice.jobId ?? undefined,
          });
        }

        console.log('[Payments] Final invoice created from deposit', { depositInvoiceId: invoiceId, finalInvoiceId });
      } catch (err) {
        console.error('[Payments] Failed to create final invoice from deposit:', err);
        // Non-fatal — deposit confirmation is already complete
      }
    }
  }

  return { success: true, ...(finalInvoiceId ? { finalInvoiceId } : {}) };
}
