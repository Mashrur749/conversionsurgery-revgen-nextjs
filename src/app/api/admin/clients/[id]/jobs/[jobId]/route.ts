import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateJobStatus, recordPayment } from '@/lib/services/revenue';
import { z } from 'zod';

const updateStatusSchema = z.object({
  action: z.literal('update_status'),
  status: z.enum(['lead', 'quoted', 'won', 'lost', 'completed']),
  quoteAmount: z.number().optional(),
  finalAmount: z.number().optional(),
  lostReason: z.string().optional(),
});

const recordPaymentSchema = z.object({
  action: z.literal('record_payment'),
  amount: z.number().min(1),
  notes: z.string().optional(),
});

const patchSchema = z.discriminatedUnion('action', [
  updateStatusSchema,
  recordPaymentSchema,
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { jobId } = await params;
  const session = await auth();

  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    if (data.action === 'update_status') {
      await updateJobStatus(jobId, data.status, {
        quoteAmount: data.quoteAmount,
        finalAmount: data.finalAmount,
        lostReason: data.lostReason,
      });
    } else if (data.action === 'record_payment') {
      await recordPayment(jobId, data.amount, data.notes);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}
