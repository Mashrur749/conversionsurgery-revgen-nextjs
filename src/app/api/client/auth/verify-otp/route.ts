import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyOTP } from '@/lib/services/otp';

const verifyOtpSchema = z
  .object({
    identifier: z.string().min(1, 'Identifier is required'),
    code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
    method: z.enum(['phone', 'email']),
  })
  .strict();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { identifier, code, method } = parsed.data;

  try {
    const result = await verifyOTP(identifier, code, method);

    if (!result.success) {
      if (result.error === 'max_attempts') {
        return NextResponse.json(
          { error: 'Too many incorrect attempts. Please request a new code.', attemptsRemaining: 0 },
          { status: 401 }
        );
      }

      if (result.error === 'wrong_code') {
        return NextResponse.json(
          { error: `Incorrect code. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining.`, attemptsRemaining: result.attemptsRemaining },
          { status: 401 }
        );
      }

      // invalid_or_expired
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 401 }
      );
    }

    // Set client session cookie — 30 days
    const cookieStore = await cookies();
    cookieStore.set('clientSessionId', result.clientId!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[OTP] Verify error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
