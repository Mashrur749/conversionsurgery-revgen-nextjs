import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';
import { startReviewRequest } from '@/lib/automations/review-request';

const statusUpdateSchema = z
  .object({
    status: z.enum(['estimate_sent', 'won', 'lost', 'completed']),
    /** Confirmed revenue in whole dollars; stored as cents in the DB. */
    confirmedRevenue: z.coerce.number().min(0).optional(),
  })
  .strict();

/**
 * PATCH /api/client/leads/[id]/status
 *
 * Portal-authenticated endpoint for contractors to update lead status.
 * - estimate_sent: triggers the 4-touch, 14-day estimate follow-up sequence
 * - won: marks the lead won with optional confirmed revenue
 * - lost: marks the lead lost
 */
export const PATCH = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.LEADS_EDIT },
  async ({ request, session, params }) => {
    const { clientId } = session;
    const { id: leadId } = params;

    const body = (await request.json()) as unknown;
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status, confirmedRevenue } = parsed.data;

    const db = getDb();

    // Verify the lead belongs to this client
    const [existing] = await db
      .select({ id: leads.id, status: leads.status })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // For estimate_sent, delegate to the automation which handles scheduling
    if (status === 'estimate_sent') {
      const result = await startEstimateFollowup({ leadId, clientId });
      if (!result.success) {
        return NextResponse.json(
          { error: result.reason ?? 'Failed to start estimate follow-up' },
          { status: 500 }
        );
      }

      const [updated] = await db
        .select({ id: leads.id, status: leads.status })
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      return NextResponse.json({ lead: updated });
    }

    // completed — mark job done and trigger review request
    if (status === 'completed') {
      const [updated] = await db
        .update(leads)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)))
        .returning({ id: leads.id, status: leads.status });

      if (!updated) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      // Trigger review request now that the work is done
      await startReviewRequest({ leadId, clientId });

      return NextResponse.json({ lead: updated });
    }

    // won / lost — simple status update
    const confirmedRevenueCents =
      typeof confirmedRevenue === 'number'
        ? Math.round(confirmedRevenue * 100)
        : undefined;

    const [updated] = await db
      .update(leads)
      .set({
        status,
        ...(confirmedRevenueCents !== undefined
          ? { confirmedRevenue: confirmedRevenueCents }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)))
      .returning({ id: leads.id, status: leads.status });

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead: updated });
  }
);
