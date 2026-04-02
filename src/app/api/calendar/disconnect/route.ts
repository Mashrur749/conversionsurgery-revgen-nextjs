import { NextResponse } from 'next/server';
import { getDb, calendarIntegrations } from '@/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const disconnectSchema = z
  .object({
    clientId: z.string().uuid('clientId must be a valid UUID'),
    provider: z.enum(['google', 'jobber', 'servicetitan', 'housecall_pro', 'outlook']),
  })
  .strict();

/** POST /api/calendar/disconnect - Revoke a calendar integration for a client */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request }) => {
    const body = (await request.json()) as unknown;
    const parsed = disconnectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clientId, provider } = parsed.data;
    const db = getDb();

    const existing = await db
      .select({ id: calendarIntegrations.id })
      .from(calendarIntegrations)
      .where(
        and(
          eq(calendarIntegrations.clientId, clientId),
          eq(calendarIntegrations.provider, provider)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    await db
      .update(calendarIntegrations)
      .set({
        isActive: false,
        syncEnabled: false,
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarIntegrations.clientId, clientId),
          eq(calendarIntegrations.provider, provider)
        )
      );

    return NextResponse.json({ success: true });
  }
);
