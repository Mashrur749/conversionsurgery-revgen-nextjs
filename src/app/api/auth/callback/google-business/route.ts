import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/permissions';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface GoogleAccountResponse {
  accounts?: Array<{ name: string }>;
}

/**
 * GET — Google OAuth callback.
 * Exchanges authorization code for tokens, stores on client record.
 * Requires an authenticated agency session (admin must be logged in).
 */
export async function GET(request: NextRequest) {
  const session = await getAgencySession();
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // clientId
  const error = searchParams.get('error');

  if (error) {
    console.error('[Google OAuth] Error:', error);
    return NextResponse.redirect(
      new URL(`/admin/clients/${state}/reviews?error=google_auth_denied`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/admin?error=invalid_callback', request.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback/google-business`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokenData.access_token) {
      console.error('[Google OAuth] Token exchange failed:', tokenData.error);
      return NextResponse.redirect(
        new URL(`/admin/clients/${state}/reviews?error=token_exchange_failed`, request.url)
      );
    }

    // Try to get the business account ID
    let accountId: string | null = null;
    try {
      const accountsRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const accountsData = (await accountsRes.json()) as GoogleAccountResponse;
      if (accountsData.accounts?.[0]?.name) {
        accountId = accountsData.accounts[0].name;
      }
    } catch (err) {
      console.warn('[Google OAuth] Could not fetch account ID:', err);
    }

    // Store tokens on client
    const db = getDb();
    await db
      .update(clients)
      .set({
        googleAccessToken: tokenData.access_token,
        googleRefreshToken: tokenData.refresh_token || null,
        googleTokenExpiresAt: new Date(
          Date.now() + (tokenData.expires_in || 3600) * 1000
        ),
        googleBusinessAccountId: accountId,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, state));

    return NextResponse.redirect(
      new URL(`/admin/clients/${state}/reviews?google=connected`, request.url)
    );
  } catch (err) {
    console.error('[Google OAuth] Callback error:', err);
    return NextResponse.redirect(
      new URL(`/admin/clients/${state}/reviews?error=callback_failed`, request.url)
    );
  }
}
