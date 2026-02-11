import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { payments, leads, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { generatePaymentMessage } from '@/lib/services/stripe';

/**
 * POST /api/payments/[id]/send - Send payment link via SMS
 * Requires authentication. Sends the payment link to the lead's phone number.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[Payments] Sending payment link via SMS');
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);

  if (!payment || !payment.stripePaymentLinkUrl) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (!payment.leadId || !payment.clientId) {
    return NextResponse.json({ error: 'Payment missing lead or client' }, { status: 400 });
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, payment.leadId))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, payment.clientId))
    .limit(1);

  if (!lead || !client) {
    return NextResponse.json({ error: 'Lead or client not found' }, { status: 404 });
  }

  if (!client.twilioNumber) {
    return NextResponse.json({ error: 'Client has no Twilio number configured' }, { status: 400 });
  }

  // Generate and send message
  const message = generatePaymentMessage(
    payment.amount,
    payment.stripePaymentLinkUrl
  );

  const result = await sendSMS(lead.phone, client.twilioNumber, message);

  if (!result.success) {
    console.error('[Payments] Failed to send SMS:', result);
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
  }

  // Update sent timestamp
  await db
    .update(payments)
    .set({ linkSentAt: new Date() })
    .where(eq(payments.id, id));

  console.log('[Payments] Payment link sent successfully', { paymentId: id });
  return NextResponse.json({ success: true, message });
}
