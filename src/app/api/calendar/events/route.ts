import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createEvent, getEvents } from '@/lib/services/calendar';
import { z } from 'zod';

const listEventsQuerySchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

const createEventSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  eventType: z.string().optional(),
  assignedTeamMemberId: z.string().uuid().optional(),
});

/** GET /api/calendar/events - List calendar events for a client within a date range */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listEventsQuerySchema.safeParse({
    clientId: searchParams.get('clientId'),
    start: searchParams.get('start') || undefined,
    end: searchParams.get('end') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { clientId, start, end } = parsed.data;

  try {
    const startDate = start ? new Date(start) : new Date();
    const endDate = end
      ? new Date(end)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const events = await getEvents(clientId, startDate, endDate);
    return NextResponse.json(events);
  } catch (error) {
    console.error('[Calendar Events GET] Failed to fetch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/** POST /api/calendar/events - Create a new calendar event */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const eventId = await createEvent({
      ...data,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    });

    return NextResponse.json({ eventId });
  } catch (error) {
    console.error('[Calendar Events POST] Failed to create:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
