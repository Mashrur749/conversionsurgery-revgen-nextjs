import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/permissions';
import { handleGoogleCallback } from '@/lib/services/calendar';

/** GET /api/auth/callback/google-calendar - OAuth callback handler for Google Calendar */
export async function GET(request: NextRequest) {
  const session = await getAgencySession();
  if (!session) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // clientId
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    console.warn('[Google Calendar Callback] OAuth denied by user, clientId:', state);
    return NextResponse.redirect(
      `${appUrl}/admin/clients/${state}/settings?error=google_denied`
    );
  }

  if (!code || !state) {
    console.warn('[Google Calendar Callback] Missing code or state in callback');
    return NextResponse.redirect(
      `${appUrl}/admin/clients/${state}/settings?error=invalid_callback`
    );
  }

  try {
    await handleGoogleCallback(code, state);

    return NextResponse.redirect(
      `${appUrl}/admin/clients/${state}/settings?success=google_connected`
    );
  } catch (err) {
    console.error('[Google Calendar Callback] Token exchange failed:', err);

    return NextResponse.redirect(
      `${appUrl}/admin/clients/${state}/settings?error=google_failed`
    );
  }
}
