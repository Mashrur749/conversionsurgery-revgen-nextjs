import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET — Initiate Google OAuth for a client.
 * Redirects admin to Google consent screen with Business Profile scopes.
 */
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!googleClientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    const redirectUri = `${appUrl}/api/auth/callback/google-business`;
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', clientId); // Pass clientId as state

    return NextResponse.redirect(authUrl.toString());
  }
);

/**
 * DELETE — Disconnect Google Business for a client.
 * Clears all Google OAuth tokens from the client record.
 */
export const DELETE = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const [updated] = await db
      .update(clients)
      .set({
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
        googleBusinessAccountId: null,
        googleLocationId: null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }
);
