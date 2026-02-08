import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-session';
import { scheduleAppointmentReminders } from '@/lib/automations/appointment-reminder';
import { z } from 'zod';

const schema = z.object({
  leadId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  address: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authSession = await getAuthSession();
  if (!authSession?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { leadId, date, time, address } = schema.parse(body);

    const clientId = authSession.clientId;

    const result = await scheduleAppointmentReminders({
      leadId,
      clientId,
      date,
      time,
      address,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Appointment error:', error);
    return NextResponse.json({ error: 'Failed to schedule' }, { status: 500 });
  }
}
