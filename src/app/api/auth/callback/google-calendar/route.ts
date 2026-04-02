import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/permissions';
import { getClientSession } from '@/lib/client-auth';
import { handleGoogleCallback, parseOAuthState } from '@/lib/services/calendar';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/** GET /api/auth/callback/google-calendar - OAuth callback handler for Google Calendar (admin + portal) */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Parse state to determine origin (admin vs portal) and clientId
  const { clientId, origin } = stateRaw ? parseOAuthState(stateRaw) : { clientId: '', origin: 'admin' as const };

  const redirectBase = origin === 'portal'
    ? `${appUrl}/client/settings`
    : `${appUrl}/admin/clients/${clientId}/settings`;

  // Validate session based on origin
  if (origin === 'portal') {
    const session = await getClientSession();
    if (!session) {
      return NextResponse.redirect(`${appUrl}/client/login`);
    }
    // Verify the portal user belongs to this client
    if (session.clientId !== clientId) {
      return NextResponse.redirect(`${redirectBase}?error=google_denied`);
    }
  } else {
    const session = await getAgencySession();
    if (!session) {
      return NextResponse.redirect(`${appUrl}/login`);
    }
  }

  if (error) {
    console.warn('[Google Calendar Callback] OAuth denied by user, clientId:', clientId, 'origin:', origin);
    return NextResponse.redirect(`${redirectBase}?error=google_denied`);
  }

  if (!code || !clientId) {
    console.warn('[Google Calendar Callback] Missing code or state in callback');
    return NextResponse.redirect(`${redirectBase}?error=invalid_callback`);
  }

  try {
    await handleGoogleCallback(code, clientId);

    return NextResponse.redirect(`${redirectBase}?success=google_connected`);
  } catch (err) {
    logSanitizedConsoleError('[Google Calendar Callback] Token exchange failed:', err, {
      clientId,
      origin,
    });

    return NextResponse.redirect(`${redirectBase}?error=google_failed`);
  }
}
