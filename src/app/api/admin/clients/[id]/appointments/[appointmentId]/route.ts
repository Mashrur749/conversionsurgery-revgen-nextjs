import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { appointments, calendarEvents } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const reassignAppointmentSchema = z.object({
  assignedTeamMemberId: z.string().uuid(),
}).strict();

export const PATCH = adminClientRoute<{ id: string; appointmentId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId, params }) => {
    const body = await request.json();
    const data = reassignAppointmentSchema.parse(body);

    const db = getDb();

    // Verify the appointment belongs to this client
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, params.appointmentId),
          eq(appointments.clientId, clientId)
        )
      )
      .limit(1);

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update the appointment
    const [updated] = await db
      .update(appointments)
      .set({
        assignedTeamMemberId: data.assignedTeamMemberId,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, params.appointmentId))
      .returning();

    // Also update linked calendar events for the same lead (excluding cancelled)
    await db
      .update(calendarEvents)
      .set({
        assignedTeamMemberId: data.assignedTeamMemberId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.leadId, appointment.leadId),
          eq(calendarEvents.clientId, clientId),
          ne(calendarEvents.status, 'cancelled')
        )
      );

    return NextResponse.json({ appointment: updated });
  }
);
