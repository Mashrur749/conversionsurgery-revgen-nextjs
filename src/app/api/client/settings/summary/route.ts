import { NextResponse } from 'next/server';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

const updateSchema = z.object({
  enabled: z.boolean(),
  day: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const PUT = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request, session }) => {
    const { clientId } = session;

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
  }
);
