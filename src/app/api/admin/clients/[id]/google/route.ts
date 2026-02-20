import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/**
 * GET — Initiate Google OAuth for a client.
 * Redirects admin to Google consent screen with Business Profile scopes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  const redirectUri = `${appUrl}/api/auth/callback/google-business`;
  const scopes = [
    'https://www.googleapis.com/auth/business.manage',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', id); // Pass clientId as state

  return NextResponse.redirect(authUrl.toString());
}

/**
 * DELETE — Disconnect Google Business for a client.
 * Clears all Google OAuth tokens from the client record.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

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
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!updated) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
