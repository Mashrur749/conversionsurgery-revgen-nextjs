import { getDb, clients, leads, invoices, scheduledMessages } from '@/db';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays, isFuture, isToday } from 'date-fns';

interface PaymentPayload {
  leadId: string;
  clientId: string;
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;      // YYYY-MM-DD
  paymentLink?: string;
}

const PAYMENT_SCHEDULE = [
  { daysFromDue: 0, template: 'payment_due', step: 1 },
  { daysFromDue: 3, template: 'payment_day_3', step: 2 },
  { daysFromDue: 7, template: 'payment_day_7', step: 3 },
  { daysFromDue: 14, template: 'payment_day_14', step: 4 },
];

export async function startPaymentReminder(payload: PaymentPayload) {
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
  const invoiceCreated = await db
    .insert(invoices)
    .values({
      leadId,
      clientId,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      amount: amount ? String(amount) : null,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      paymentLink,
      status: 'pending',
    })
    .returning();

  const invoice = invoiceCreated[0];

  // 3. Cancel existing payment sequences
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

  // 4. Schedule reminders
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
      paymentLink: paymentLink || '[payment link]',
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
  }

  return {
    success: true,
    invoiceId: invoice.id,
    scheduledCount: scheduledIds.length,
    scheduledIds,
  };
}

export async function markInvoicePaid(invoiceId: string) {
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
  }

  return { success: true };
}
