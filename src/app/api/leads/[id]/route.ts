import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { clients } from '@/db/schema/clients';
import { scheduledMessages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { sendAlert } from '@/lib/services/agency-communication';

const leadUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  temperature: z.string().max(10).optional(),
  notes: z.string().max(5000).optional(),
  projectType: z.string().max(255).optional(),
  /** Confirmed revenue in whole dollars; stored as cents in the DB. */
  confirmedRevenue: z.coerce.number().min(0).optional().nullable(),
  address: z.string().max(500).optional(),
  name: z.string().max(255).optional(),
  email: z.string().email().max(255).optional().nullable(),
  actionRequired: z.boolean().optional(),
  actionRequiredReason: z.string().max(255).optional().nullable(),
  conversationMode: z.enum(['ai', 'human', 'paused']).optional(),
}).strict();

/** PATCH /api/leads/[id] - Update a lead's fields (scoped to the authenticated client). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = session?.client?.id;
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = leadUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();

    // Destructure to separate confirmedRevenue (dollars) from the rest of the
    // update payload so we can store it as cents in the DB.
    const { confirmedRevenue: confirmedRevenueDollars, ...restData } = parsed.data;
    const confirmedRevenueCents =
      typeof confirmedRevenueDollars === 'number'
        ? Math.round(confirmedRevenueDollars * 100)
        : confirmedRevenueDollars; // null or undefined — leave as-is

    const updated = await db
      .update(leads)
      .set({
        ...restData,
        ...(confirmedRevenueCents !== undefined
          ? { confirmedRevenue: confirmedRevenueCents }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updatedLead = updated[0];

    // Cancel all unsent, uncancelled scheduled messages when a lead is marked won or lost
    if (parsed.data.status === 'won' || parsed.data.status === 'lost') {
      try {
        await db
          .update(scheduledMessages)
          .set({
            cancelled: true,
            cancelledAt: new Date(),
            cancelledReason: `Lead status changed to ${parsed.data.status}`,
          })
          .where(
            and(
              eq(scheduledMessages.leadId, id),
              eq(scheduledMessages.sent, false),
              eq(scheduledMessages.cancelled, false)
            )
          );
      } catch (cancelError) {
        // Non-fatal: log and continue — the status update already succeeded
        console.error('[LeadManagement] Scheduled message cancellation failed:', cancelError);
      }
    }

    // Track job_won funnel event for AI attribution
    if (parsed.data.status === 'won') {
      try {
        const { trackFunnelEvent } = await import('@/lib/services/funnel-tracking');
        await trackFunnelEvent({
          clientId,
          leadId: updatedLead.id,
          eventType: 'job_won',
          valueCents:
            typeof updatedLead.confirmedRevenue === 'number'
              ? updatedLead.confirmedRevenue
              : undefined,
        });
      } catch {
        // Non-fatal: funnel tracking failure must not block the status update
      }
    }

    // Win notification: send SMS to client owner when a lead is marked as won
    if (parsed.data.status === 'won') {
      try {
        const [clientRow] = await db
          .select({ businessName: clients.businessName, phone: clients.phone })
          .from(clients)
          .where(eq(clients.id, clientId))
          .limit(1);

        if (clientRow?.phone) {
          const leadName = updatedLead.name || updatedLead.phone;
          // confirmedRevenue is stored in cents; convert to dollars for display
          const confirmedRevenueCentsDisplay = updatedLead.confirmedRevenue;
          const quoteDisplay =
            typeof confirmedRevenueCentsDisplay === 'number'
              ? `$${Math.round(confirmedRevenueCentsDisplay / 100).toLocaleString()}`
              : 'N/A';
          const firstEngaged = new Date(updatedLead.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          const smsBody =
            `${clientRow.businessName} recovered ${leadName} — estimated project value ${quoteDisplay}. ` +
            `This lead was first engaged by the system on ${firstEngaged}.`;

          await sendAlert({
            clientId,
            message: smsBody,
            isUrgent: false,
          });
        }
      } catch (notifyError) {
        // Non-fatal: log and continue — the status update already succeeded
        console.error('[LeadManagement] Win notification failed:', notifyError);
      }
    }

    // Completed → trigger review request (job is done)
    if (parsed.data.status === 'completed') {
      try {
        const { startReviewRequest } = await import('@/lib/automations/review-request');
        await startReviewRequest({ leadId: updatedLead.id, clientId });
      } catch (reviewError) {
        console.error('[LeadManagement] Review request trigger failed:', reviewError);
      }
    }

    // Webhook dispatch: fire on status change to won, completed, or lost (Zapier/Jobber integration)
    if (parsed.data.status === 'won' || parsed.data.status === 'completed' || parsed.data.status === 'lost') {
      try {
        const { dispatchWebhook } = await import('@/lib/services/webhook-dispatch');
        await dispatchWebhook(clientId, 'lead.status_changed', {
          leadId: updatedLead.id,
          name: updatedLead.name,
          phone: updatedLead.phone,
          email: updatedLead.email,
          status: parsed.data.status,
          confirmedRevenue:
            typeof updatedLead.confirmedRevenue === 'number'
              ? Math.round(updatedLead.confirmedRevenue / 100)
              : null,
          projectType: updatedLead.projectType,
          address: updatedLead.address,
        });
      } catch (webhookError) {
        // Non-fatal: log and continue — the status update already succeeded
        console.error('[LeadManagement] Webhook dispatch failed:', webhookError);
      }
    }

    return NextResponse.json(updatedLead);
  } catch (error) {
    return safeErrorResponse('[LeadManagement][leads.patch]', error, 'Failed');
  }
}
