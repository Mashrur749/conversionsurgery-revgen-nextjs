import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fullSync } from '@/lib/services/calendar';
import { z } from 'zod';

const syncSchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
});

/** POST /api/calendar/sync - Trigger a full bidirectional sync for a client */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = syncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;
    const results = await fullSync(clientId);

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Calendar Sync POST] Full sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
