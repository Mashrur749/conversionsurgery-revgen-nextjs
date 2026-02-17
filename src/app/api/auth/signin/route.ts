import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { verificationTokens, users } from '@/db/schema/auth';
import { sendEmail } from '@/lib/services/resend';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Custom Magic Link Authentication
 *
 * POST /api/auth/signin
 * Body: { "email": "user@example.com" }
 *
 * Flow:
 * 1. Generate random token
 * 2. Store in verification_tokens table
 * 3. Send email with magic link
 * 4. User clicks link to /api/auth/verify?token=...&email=...
 * 5. Verify token, create user & session
 * 6. Redirect to dashboard
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string };
    const email = body.email?.toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const db = getDb();

    console.log(`[SignIn] Request for: ${email}`);

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Delete old tokens for this email
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));

    // Store new token
    await db.insert(verificationTokens).values({
      identifier: email,
      token,
      expires: expiresAt,
    });

    console.log(`[SignIn] Token stored for ${email}`);

    // Build verification URL
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

    console.log(`[SignIn] Magic Link: ${verifyUrl}`);

    // Send email
    await sendEmail({
      to: email,
      subject: 'Sign in to ConversionSurgery',
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B2F26;">Sign in to ConversionSurgery</h2>
          <p>Click below to sign in:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Sign In</a>
          <p style="color: #666; font-size: 12px;">Link expires in 24 hours</p>
        </div>
      `,
    });

    console.log(`[SignIn] Email sent to ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Check your email for the sign-in link',
    });
  } catch (error) {
    console.error('[SignIn] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process sign-in request' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST email to this endpoint' });
}
