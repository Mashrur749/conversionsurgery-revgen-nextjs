import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { appointments } from '@/db/schema/appointments';
import { leads } from '@/db/schema/leads';
import { eq, and } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { startReviewRequest } from '@/lib/automations/review-request';

/**
 * POST /api/client/appointments/[id]/complete
 *
 * Marks an appointment as completed and triggers a review request
 * for the associated lead.
 */
export const POST = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.LEADS_EDIT },
  async ({ session, params }) => {
    const { clientId } = session;
    const { id: appointmentId } = params;

    const db = getDb();

    // Verify the appointment belongs to this client
    const [existing] = await db
      .select({
        id: appointments.id,
        status: appointments.status,
        leadId: appointments.leadId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.clientId, clientId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (existing.status === 'completed') {
      return NextResponse.json({ error: 'Appointment is already completed' }, { status: 400 });
    }

    // Mark appointment as completed
    const [updated] = await db
      .update(appointments)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.clientId, clientId)
        )
      )
      .returning({
        id: appointments.id,
        status: appointments.status,
        leadId: appointments.leadId,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
      });

    if (!updated) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Verify the lead belongs to this client before triggering review request
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, existing.leadId), eq(leads.clientId, clientId)))
      .limit(1);

    if (lead) {
      // Non-fatal: review request failure should not block the completion response
      try {
        await startReviewRequest({ leadId: existing.leadId, clientId });
      } catch {
        // Log silently — completion is already recorded
      }
    }

    return NextResponse.json({ appointment: updated });
  }
);
