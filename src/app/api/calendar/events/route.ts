import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createEvent, getEvents } from '@/lib/services/calendar';
import { z } from 'zod';

const createEventSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  eventType: z.string().optional(),
  assignedTeamMemberId: z.string().uuid().optional(),
});

// GET - List events
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  try {
    const startDate = start ? new Date(start) : new Date();
    const endDate = end
      ? new Date(end)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const events = await getEvents(clientId, startDate, endDate);
    return NextResponse.json(events);
  } catch (error) {
    console.error('Calendar events GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST - Create event
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createEventSchema.parse(body);

    const eventId = await createEvent({
      ...data,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    });

    return NextResponse.json({ eventId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Calendar events POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
