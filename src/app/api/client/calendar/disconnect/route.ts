import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb, calendarIntegrations } from '@/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const disconnectSchema = z
  .object({
    provider: z.enum(['google']),
  })
  .strict();

/** POST /api/client/calendar/disconnect - Disconnect a calendar integration for the portal client */
export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request, session }) => {
    const body = await request.json();
    const parsed = disconnectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { provider } = parsed.data;

    try {
      const db = getDb();

      const [existing] = await db
        .select({ id: calendarIntegrations.id })
        .from(calendarIntegrations)
        .where(
          and(
            eq(calendarIntegrations.clientId, session.clientId),
            eq(calendarIntegrations.provider, provider)
          )
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
      }

      await db
        .update(calendarIntegrations)
        .set({
          isActive: false,
          syncEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(calendarIntegrations.id, existing.id));

      return NextResponse.json({ success: true });
    } catch (error) {
      return safeErrorResponse('[Calendar][portal.disconnect]', error, 'Failed to disconnect');
    }
  }
);
