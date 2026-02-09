import { NextRequest, NextResponse } from 'next/server';
import { handleGoogleCallback } from '@/lib/services/calendar';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // clientId
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/admin/clients/${state}/settings?error=google_denied`
    );
  }

  if (!code || !state) {
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
    console.error('Google Calendar callback error:', err);

    return NextResponse.redirect(
      `${appUrl}/admin/clients/${state}/settings?error=google_failed`
    );
  }
}
