import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { verificationTokens, users, sessions } from '@/db/schema/auth';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Token Verification Endpoint
 *
 * Handles the magic link callback:
 * GET /api/auth/verify?token=...&email=...
 *
 * 1. Verify token exists and isn't expired
 * 2. Create user if needed
 * 3. Create session cookie
 * 4. Redirect to dashboard
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email')?.toLowerCase().trim();

    if (!token || !email) {
      return NextResponse.redirect(new URL('/login?error=missing_params', url.origin));
    }

    const db = getDb();

    console.log(`[Verify] Token for: ${email}`);

    // Find and verify token
    const tokenRecord = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, token)
        )
      )
      .limit(1);

    if (!tokenRecord || tokenRecord.length === 0) {
      console.log(`[Verify] Token not found`);
      return NextResponse.redirect(new URL('/login?error=invalid_token', url.origin));
    }

    const dbToken = tokenRecord[0];

    // Check expiry
    if (new Date() > dbToken.expires) {
      console.log(`[Verify] Token expired`);
      // Delete expired token
      await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
      return NextResponse.redirect(new URL('/login?error=token_expired', url.origin));
    }

    console.log(`[Verify] Token valid, creating session...`);

    // Find or create user
    let userRecord = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;
    let clientId: string | null = null;

    if (!userRecord || userRecord.length === 0) {
      // Create new user
      const newUser = await db
        .insert(users)
        .values({
          email,
          name: email.split('@')[0], // Use email prefix as default name
        })
        .returning();

      userId = newUser[0].id;
      clientId = newUser[0].clientId;
      console.log(`[Verify] Created user: ${userId}`);
    } else {
      userId = userRecord[0].id;
      clientId = userRecord[0].clientId;
      console.log(`[Verify] Found existing user: ${userId}, client: ${clientId}`);
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(sessions).values({
      sessionToken,
      userId,
      expires: sessionExpires,
    });

    console.log(`[Verify] Session created: ${sessionToken}`);

    // Delete verification token
    await db.delete(verificationTokens).where(eq(verificationTokens.token, token));

    // Create response with session cookie
    const response = NextResponse.redirect(new URL('/dashboard', url.origin));

    // Set NextAuth session cookie
    response.cookies.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    console.log(`[Verify] Redirecting to dashboard`);

    return response;
  } catch (error) {
    console.error('[Verify] Error:', error);
    return NextResponse.redirect(new URL('/login?error=server_error', new URL(req.url).origin));
  }
}
