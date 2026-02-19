import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLink } from '@/lib/services/magic-link';
import { setClientSessionCookie } from '@/lib/client-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await validateMagicLink(token);

  if (!result.valid) {
    return NextResponse.redirect(
      new URL('/link-expired', request.url)
    );
  }

  // Set HMAC-signed client session cookie
  await setClientSessionCookie(result.clientId!);

  return NextResponse.redirect(
    new URL('/client', request.url)
  );
}
