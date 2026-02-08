import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-session';
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

export async function POST(request: NextRequest) {
  const authSession = await getAuthSession();
  if (!authSession?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const clientId = authSession.clientId;

    const result = await startPaymentReminder({ ...data, clientId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Payment reminder error:', error);
    return NextResponse.json({ error: 'Failed to start sequence' }, { status: 500 });
  }
}

// Mark invoice as paid
export async function PATCH(request: NextRequest) {
  const authSession = await getAuthSession();
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { invoiceId } = paidSchema.parse(body);

    const result = await markInvoicePaid(invoiceId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Mark paid error:', error);
    return NextResponse.json({ error: 'Failed to mark paid' }, { status: 500 });
  }
}
