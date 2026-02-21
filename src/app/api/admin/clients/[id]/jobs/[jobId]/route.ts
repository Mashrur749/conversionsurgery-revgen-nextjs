import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
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

export const PATCH = adminClientRoute<{ id: string; jobId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId }) => {
    const { jobId } = params;

    // Verify job belongs to this client (IDOR prevention)
    const db = getDb();
    const [job] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.clientId, clientId)))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

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
  }
);
