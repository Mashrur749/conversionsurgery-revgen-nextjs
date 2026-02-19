import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { updateJobStatus, recordPayment } from '@/lib/services/revenue';
import { getDb } from '@/db';
import { jobs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
  const { id, jobId } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  // Verify job belongs to this client (IDOR prevention)
  const db = getDb();
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.clientId, id)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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
