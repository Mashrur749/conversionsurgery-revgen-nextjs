import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, calendarIntegrations } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().uuid('Integration ID must be a valid UUID'),
});

/** DELETE /api/calendar/integrations/[id] - Disconnect (soft-delete) a calendar integration */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawParams = await params;
  const parsed = paramsSchema.safeParse(rawParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = parsed.data;

  try {
    const db = getDb();

    const [existing] = await db
      .select({ id: calendarIntegrations.id })
      .from(calendarIntegrations)
      .where(eq(calendarIntegrations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    await db
      .update(calendarIntegrations)
      .set({
        isActive: false,
        syncEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Integration DELETE] Failed to disconnect:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}
