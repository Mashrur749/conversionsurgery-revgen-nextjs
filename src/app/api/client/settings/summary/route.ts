import { NextRequest, NextResponse } from 'next/server';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getClientSession } from '@/lib/client-auth';

const updateSchema = z.object({
  enabled: z.boolean(),
  day: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function PUT(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { clientId } = session;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { enabled, day, time } = parsed.data;
    const db = getDb();

    await db
      .update(clients)
      .set({
        weeklySummaryEnabled: enabled,
        weeklySummaryDay: day,
        weeklySummaryTime: time,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update summary settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
