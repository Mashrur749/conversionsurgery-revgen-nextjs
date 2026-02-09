import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { payments } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createPaymentLink, createInvoiceWithLink } from '@/lib/services/stripe';
import { z } from 'zod';

// GET - List payments for a client or lead
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const leadId = searchParams.get('leadId');

  const db = getDb();
  const conditions = [];
  if (clientId) conditions.push(eq(payments.clientId, clientId));
  if (leadId) conditions.push(eq(payments.leadId, leadId));

  if (conditions.length === 0) {
    return NextResponse.json({ error: 'clientId or leadId required' }, { status: 400 });
  }

  const results = await db
    .select()
    .from(payments)
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(100);

  return NextResponse.json(results);
}

const createPaymentSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  amount: z.number().positive(), // in dollars
  description: z.string().optional(),
  type: z.enum(['deposit', 'progress', 'final', 'full']).default('full'),
  createInvoice: z.boolean().default(false),
  dueDate: z.string().optional(),
});

// POST - Create new payment link
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createPaymentSchema.parse(body);

    const amountCents = Math.round(data.amount * 100);

    if (data.createInvoice) {
      const result = await createInvoiceWithLink({
        clientId: data.clientId,
        leadId: data.leadId,
        totalAmount: amountCents,
        description: data.description || 'Service payment',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });

      return NextResponse.json(result);
    }

    const result = await createPaymentLink({
      clientId: data.clientId,
      leadId: data.leadId,
      amount: amountCents,
      description: data.description || 'Payment',
      type: data.type,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Payments] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
