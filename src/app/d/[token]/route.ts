import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLink } from '@/lib/services/magic-link';
import { cookies } from 'next/headers';

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

  // Set client session cookie
  const cookieStore = await cookies();
  cookieStore.set('clientSessionId', result.clientId!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return NextResponse.redirect(
    new URL('/client', request.url)
  );
}
