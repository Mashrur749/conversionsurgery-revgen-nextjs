import { getDb, clients, otpCodes } from '@/db';
import { eq, and, gt, isNull, desc } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail } from '@/lib/services/resend';

const OTP_EXPIRY_MINUTES = 5;
const MAX_REQUESTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;

/** Generate a cryptographically secure 6-digit OTP (Cloudflare Workers compatible) */
export function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 900000) + 100000;
  return code.toString();
}

interface OTPResult {
  success: boolean;
  retryAfterSeconds?: number;
  error?: string;
}

/** Create and send a phone OTP. Returns success even if phone not found (silent fail). */
export async function createAndSendPhoneOTP(rawPhone: string): Promise<OTPResult> {
  const phone = normalizePhoneNumber(rawPhone);
  const db = getDb();

  // Find active client by phone
  const [client] = await db
    .select({ id: clients.id, twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(and(eq(clients.phone, phone), eq(clients.status, 'active')))
    .limit(1);

  // Silent fail — don't reveal whether phone exists
  if (!client) {
    return { success: true };
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(db, 'phone', phone);
  if (!rateLimitResult.allowed) {
    return { success: false, retryAfterSeconds: rateLimitResult.retryAfterSeconds, error: 'rate_limit' };
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(otpCodes).values({
    phone,
    clientId: client.id,
    code,
    expiresAt,
  });

  // Send via client's Twilio number, fallback to platform number
  const from = client.twilioNumber || process.env.TWILIO_PHONE_NUMBER!;
  try {
    await sendSMS(phone, `Your login code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`, from);
  } catch (err) {
    console.error('[OTP] SMS delivery failed:', err);
  }

  return { success: true };
}

/** Create and send an email OTP. Returns success even if email not found (silent fail). */
export async function createAndSendEmailOTP(rawEmail: string): Promise<OTPResult> {
  const email = rawEmail.toLowerCase().trim();
  const db = getDb();

  // Find active client by email
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.email, email), eq(clients.status, 'active')))
    .limit(1);

  // Silent fail
  if (!client) {
    return { success: true };
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(db, 'email', email);
  if (!rateLimitResult.allowed) {
    return { success: false, retryAfterSeconds: rateLimitResult.retryAfterSeconds, error: 'rate_limit' };
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(otpCodes).values({
    email,
    clientId: client.id,
    code,
    expiresAt,
  });

  try {
    await sendEmail({
      to: email,
      subject: 'Your login code',
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 400px; margin: 0 auto; text-align: center;">
          <h2 style="color: #1B2F26;">Your Login Code</h2>
          <p style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1B2F26; margin: 24px 0;">${code}</p>
          <p style="color: #6b6762;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[OTP] Email delivery failed:', err);
  }

  return { success: true };
}

interface VerifyResult {
  success: boolean;
  clientId?: string;
  attemptsRemaining?: number;
  error?: string;
}

/** Verify an OTP code. Returns clientId on success. */
export async function verifyOTP(
  identifier: string,
  code: string,
  method: 'phone' | 'email'
): Promise<VerifyResult> {
  const db = getDb();
  const now = new Date();

  const normalizedIdentifier =
    method === 'phone'
      ? normalizePhoneNumber(identifier)
      : identifier.toLowerCase().trim();

  const identifierColumn = method === 'phone' ? otpCodes.phone : otpCodes.email;

  // Find most recent unexpired, unverified OTP
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(identifierColumn, normalizedIdentifier),
        gt(otpCodes.expiresAt, now),
        isNull(otpCodes.verifiedAt)
      )
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!otp) {
    return { success: false, error: 'invalid_or_expired' };
  }

  // Check max attempts
  if (otp.attempts >= otp.maxAttempts) {
    return { success: false, attemptsRemaining: 0, error: 'max_attempts' };
  }

  // Increment attempts
  await db
    .update(otpCodes)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(otpCodes.id, otp.id));

  // Compare code
  if (otp.code !== code) {
    const remaining = otp.maxAttempts - (otp.attempts + 1);
    return { success: false, attemptsRemaining: remaining, error: 'wrong_code' };
  }

  // Mark as verified and invalidate all other OTPs for this identifier
  await db
    .update(otpCodes)
    .set({ verifiedAt: now })
    .where(eq(otpCodes.id, otp.id));

  return { success: true, clientId: otp.clientId };
}

/** Check rate limit: max N OTP requests per identifier per window */
async function checkRateLimit(
  db: ReturnType<typeof getDb>,
  method: 'phone' | 'email',
  identifier: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const identifierColumn = method === 'phone' ? otpCodes.phone : otpCodes.email;

  const recentOTPs = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(
      and(
        eq(identifierColumn, identifier),
        gt(otpCodes.createdAt, windowStart)
      )
    )
    .orderBy(otpCodes.createdAt);

  if (recentOTPs.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = recentOTPs[0].createdAt;
    const windowEnd = new Date(oldestInWindow.getTime() + RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
    const retryAfterSeconds = Math.ceil((windowEnd.getTime() - Date.now()) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  return { allowed: true };
}
