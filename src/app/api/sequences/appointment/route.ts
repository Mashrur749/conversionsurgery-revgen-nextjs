import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { scheduleAppointmentReminders } from '@/lib/automations/appointment-reminder';
import { z } from 'zod';

const schema = z.object({
  leadId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  address: z.string().optional(),
});

/**
 * POST /api/sequences/appointment - Schedules appointment reminders for a lead.
 * Creates appointment record and schedules day-before and 2-hour reminder messages.
 */
export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { leadId, date, time, address } = parsed.data;
    const clientId = session.clientId;

    const result = await scheduleAppointmentReminders({
      leadId,
      clientId,
      date,
      time,
      address,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[AppointmentSystem] Appointment error:', error);
    return NextResponse.json({ error: 'Failed to schedule' }, { status: 500 });
  }
}
