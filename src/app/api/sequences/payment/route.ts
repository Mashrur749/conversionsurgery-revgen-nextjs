import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { startPaymentReminder, markInvoicePaid } from '@/lib/automations/payment-reminder';
import { z } from 'zod';

const createSchema = z.object({
  leadId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  amount: z.number().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentLink: z.string().url().optional(),
});

const paidSchema = z.object({
  invoiceId: z.string().uuid(),
});

/**
 * POST /api/sequences/payment - Start a payment reminder sequence
 * Requires authentication with clientId. Creates invoice and schedules reminders.
 */
export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = createSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      console.log('[Payments] Validation failed:', errors);
      return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
    }

    const data = validation.data;
    const clientId = session.clientId;

    const result = await startPaymentReminder({ ...data, clientId });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Payments] Payment reminder error:', error);
    return NextResponse.json({ error: 'Failed to start sequence' }, { status: 500 });
  }
}

/**
 * PATCH /api/sequences/payment - Mark an invoice as paid
 * Requires authentication. Cancels remaining reminders and updates payment status.
 */
export async function PATCH(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = paidSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      console.log('[Payments] Validation failed:', errors);
      return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
    }

    const { invoiceId } = validation.data;
    const result = await markInvoicePaid(invoiceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Payments] Mark paid error:', error);
    return NextResponse.json({ error: 'Failed to mark paid' }, { status: 500 });
  }
}
