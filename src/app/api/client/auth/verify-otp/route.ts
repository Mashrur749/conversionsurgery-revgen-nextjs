import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOTP } from '@/lib/services/otp';
import { setClientSessionCookie, setClientSessionCookieWithPermissions, signBusinessSelectionToken } from '@/lib/client-auth';
import { getDb } from '@/db';
import { people } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

    // New path: person-based auth with potential multi-business
    if (result.personId && result.businesses) {
      // Check if this is the person's first login (for welcome page redirect)
      const db = getDb();
      const [person] = await db
        .select({ lastLoginAt: people.lastLoginAt })
        .from(people)
        .where(eq(people.id, result.personId))
        .limit(1);
      const isFirstLogin = !person?.lastLoginAt;

      // Update lastLoginAt
      await db
        .update(people)
        .set({ lastLoginAt: new Date() })
        .where(eq(people.id, result.personId));

      if (result.businesses.length === 1) {
        // Single business — auto-select and set cookie with permissions
        await setClientSessionCookieWithPermissions(
          result.personId,
          result.businesses[0].clientId
        );
        return NextResponse.json({
          success: true,
          ...(isFirstLogin ? { redirectTo: '/client/welcome' } : {}),
        });
      }

      // Multiple businesses — return signed token (not raw personId) for business picker
      const token = await signBusinessSelectionToken(result.personId);
      return NextResponse.json({
        success: true,
        requireBusinessSelection: true,
        businessSelectionToken: token,
        businesses: result.businesses,
      });
    }

    // Legacy path: clientId-only session
    if (result.clientId) {
      await setClientSessionCookie(result.clientId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'No active business found for this account.' },
      { status: 403 }
    );
  } catch (error) {
    console.error('[OTP] Verify error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
