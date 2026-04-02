import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb, calendarIntegrations } from '@/db';
import { eq } from 'drizzle-orm';
import { getGoogleAuthUrl } from '@/lib/services/calendar';
import { z } from 'zod';

const connectSchema = z
  .object({
    provider: z.enum(['google']),
  })
  .strict();

/** GET /api/client/calendar/integrations - List calendar integrations for the portal client */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session }) => {
    const db = getDb();
    const integrations = await db
      .select({
        id: calendarIntegrations.id,
        provider: calendarIntegrations.provider,
        isActive: calendarIntegrations.isActive,
        syncEnabled: calendarIntegrations.syncEnabled,
        lastSyncAt: calendarIntegrations.lastSyncAt,
        lastError: calendarIntegrations.lastError,
        consecutiveErrors: calendarIntegrations.consecutiveErrors,
      })
      .from(calendarIntegrations)
      .where(eq(calendarIntegrations.clientId, session.clientId));

    return NextResponse.json(integrations);
  }
);

/** POST /api/client/calendar/integrations - Start OAuth flow for Google Calendar */
export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request, session }) => {
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { provider } = parsed.data;

    if (provider !== 'google') {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const authUrl = getGoogleAuthUrl(session.clientId, 'portal');
    return NextResponse.json({ authUrl });
  }
);
