import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, calendarIntegrations } from '@/db';
import { eq } from 'drizzle-orm';
import { getGoogleAuthUrl } from '@/lib/services/calendar';
import { z } from 'zod';

const listQuerySchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
});

const connectSchema = z.object({
  clientId: z.string().uuid(),
  provider: z.enum(['google', 'jobber', 'servicetitan', 'housecall_pro', 'outlook']),
});

/** GET /api/calendar/integrations - List calendar integrations for a client */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    clientId: searchParams.get('clientId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { clientId } = parsed.data;

  try {
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
  } catch (error) {
    console.error('[Calendar Integrations GET] Failed to fetch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}

/** POST /api/calendar/integrations - Start OAuth flow for a calendar provider */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
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
        return NextResponse.json(
          { error: 'Unsupported provider' },
          { status: 400 }
        );
    }

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[Calendar Integrations POST] Failed to start OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to start OAuth flow' },
      { status: 500 }
    );
  }
}
