import { NextResponse } from 'next/server';
import { getDb, calendarIntegrations } from '@/db';
import { eq } from 'drizzle-orm';
import { getGoogleAuthUrl } from '@/lib/services/calendar';
import { z } from 'zod';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const listQuerySchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
});

const connectSchema = z
  .object({
    clientId: z.string().uuid(),
    provider: z.enum(['google', 'jobber', 'servicetitan', 'housecall_pro', 'outlook']),
  })
  .strict();

/** GET /api/calendar/integrations - List calendar integrations for a client */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      clientId: searchParams.get('clientId'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;

    const db = getDb();
    const integrations = await db
      .select({
        id: calendarIntegrations.id,
        provider: calendarIntegrations.provider,
        isActive: calendarIntegrations.isActive,
        syncEnabled: calendarIntegrations.syncEnabled,
        lastSyncAt: calendarIntegrations.lastSyncAt,
        lastError: calendarIntegrations.lastError,
      })
      .from(calendarIntegrations)
      .where(eq(calendarIntegrations.clientId, clientId));

    return NextResponse.json(integrations);
  }
);

/** POST /api/calendar/integrations - Start OAuth flow for a calendar provider */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request }) => {
    const body = (await request.json()) as unknown;
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clientId, provider } = parsed.data;
    let authUrl: string;

    switch (provider) {
      case 'google':
        authUrl = getGoogleAuthUrl(clientId);
        break;
      default:
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    return NextResponse.json({ authUrl });
  }
);
