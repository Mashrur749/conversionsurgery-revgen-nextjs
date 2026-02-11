import { getDb } from '@/db';
import { clients, leads, invoices, scheduledMessages, payments, paymentReminders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays, isFuture, isToday } from 'date-fns';
import { createPaymentLink } from '@/lib/services/stripe';

interface PaymentPayload {
  leadId: string;
  clientId: string;
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;      // YYYY-MM-DD
  paymentLink?: string;
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
 * Starts a payment reminder sequence for a client's invoice.
 * Creates invoice record, generates Stripe payment link if needed, and schedules reminder messages.
 * @param payload - Payment details including lead, client, amount, and due date
 * @returns Success status, invoice ID, payment link, and scheduled message IDs
 */
export async function startPaymentReminder(payload: PaymentPayload) {
  console.log('[Payments] Starting payment reminder sequence', { leadId: payload.leadId, clientId: payload.clientId });
  const db = getDb();
  const { leadId, clientId, invoiceNumber, amount, dueDate, paymentLink } = payload;

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
    })
    .returning();

  const invoice = invoiceCreated[0];

  // 3. Auto-create Stripe payment link if not provided and amount is set
  let resolvedPaymentLink = paymentLink;
  if (!resolvedPaymentLink && amountCents && amountCents > 0) {
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
    } catch (err) {
      console.error('[Payments] Failed to create Stripe payment link:', err);
      // Continue without a payment link
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

  for (const item of PAYMENT_SCHEDULE) {
    const sendAt = addDays(dueDateObj, item.daysFromDue);
    sendAt.setHours(10, 0, 0, 0);

    // Skip past dates (except day 0 if it's today)
    const shouldSchedule = isFuture(sendAt) || (item.daysFromDue === 0 && isToday(dueDateObj));
    if (!shouldSchedule) continue;

    const content = renderTemplate(item.template, {
      name: lead.name || 'there',
      invoiceNumber: invoice.invoiceNumber || '',
      amount: amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00',
      currencySymbol: '$',
      paymentLink: resolvedPaymentLink || '[payment link]',
      ownerName: client.ownerName,
      businessName: client.businessName,
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
 * @param invoiceId - The invoice ID to mark as paid
 * @returns Success status
 */
export async function markInvoicePaid(invoiceId: string) {
  console.log('[Payments] Marking invoice as paid', { invoiceId });
  const db = getDb();

  // Mark invoice as paid
  await db
    .update(invoices)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  // Get invoice to find lead
  const invoiceResult = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (invoiceResult.length && invoiceResult[0].leadId) {
    // Cancel remaining payment reminders
    await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Invoice paid',
      })
      .where(and(
        eq(scheduledMessages.leadId, invoiceResult[0].leadId),
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
  }

  return { success: true };
}
