import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, calendarIntegrations } from '@/db';
import { eq } from 'drizzle-orm';
import { getGoogleAuthUrl } from '@/lib/services/calendar';
import { z } from 'zod';

const connectSchema = z.object({
  clientId: z.string().uuid(),
  provider: z.enum(['google', 'jobber', 'servicetitan', 'housecall_pro', 'outlook']),
});

// GET - List integrations
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

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
    console.error('Calendar integrations GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}

// POST - Start OAuth flow
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, provider } = connectSchema.parse(body);

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Calendar integrations POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start OAuth flow' },
      { status: 500 }
    );
  }
}
