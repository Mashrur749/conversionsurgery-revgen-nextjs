import { getDb, clients, otpCodes } from '@/db';
import { people, clientMemberships } from '@/db/schema';
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

  // Look up person by phone (new path)
  const [person] = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.phone, phone))
    .limit(1);

  if (person) {
    // Check for active client memberships
    const memberships = await db
      .select({
        clientId: clientMemberships.clientId,
        twilioNumber: clients.twilioNumber,
      })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(
        and(
          eq(clientMemberships.personId, person.id),
          eq(clientMemberships.isActive, true),
          eq(clients.status, 'active')
        )
      );

    if (memberships.length > 0) {
      // Rate limit check
      const rateLimitResult = await checkRateLimit(db, 'phone', phone);
      if (!rateLimitResult.allowed) {
        return { success: false, retryAfterSeconds: rateLimitResult.retryAfterSeconds, error: 'rate_limit' };
      }

      const code = generateOTP();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await db.insert(otpCodes).values({
        phone,
        personId: person.id,
        clientId: memberships[0].clientId,
        code,
        expiresAt,
      });

      // Send via first membership's client Twilio number, fallback to platform
      const from = memberships[0].twilioNumber || process.env.TWILIO_PHONE_NUMBER!;
      try {
        await sendSMS(phone, `Your login code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`, from);
      } catch (err) {
        console.error('[OTP] SMS delivery failed:', err);
      }

      return { success: true };
    }
  }

  // Fallback: try legacy path (clients.phone) for pre-migration users
  const [client] = await db
    .select({ id: clients.id, twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(and(eq(clients.phone, phone), eq(clients.status, 'active')))
    .limit(1);

  if (!client) {
    return { success: true }; // Silent fail
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

  // Look up person by email (new path)
  const [person] = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.email, email))
    .limit(1);

  if (person) {
    // Check for active client memberships
    const memberships = await db
      .select({ clientId: clientMemberships.clientId })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(
        and(
          eq(clientMemberships.personId, person.id),
          eq(clientMemberships.isActive, true),
          eq(clients.status, 'active')
        )
      );

    if (memberships.length > 0) {
      const rateLimitResult = await checkRateLimit(db, 'email', email);
      if (!rateLimitResult.allowed) {
        return { success: false, retryAfterSeconds: rateLimitResult.retryAfterSeconds, error: 'rate_limit' };
      }

      const code = generateOTP();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await db.insert(otpCodes).values({
        email,
        personId: person.id,
        clientId: memberships[0].clientId,
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
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you didn&apos;t request this code, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (err) {
        console.error('[OTP] Email delivery failed:', err);
      }

      return { success: true };
    }
  }

  // Fallback: try legacy path (clients.email) for pre-migration users
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.email, email), eq(clients.status, 'active')))
    .limit(1);

  if (!client) {
    return { success: true }; // Silent fail
  }

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
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you didn&apos;t request this code, you can safely ignore this email.</p>
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
  personId?: string;
  businesses?: Array<{ clientId: string; businessName: string }>;
  attemptsRemaining?: number;
  error?: string;
}

/** Verify an OTP code. Returns personId + business list on success. */
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

  // Compare code using constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(otp.code);
  const b = encoder.encode(code);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  if (mismatch !== 0) {
    const remaining = otp.maxAttempts - (otp.attempts + 1);
    return { success: false, attemptsRemaining: remaining, error: 'wrong_code' };
  }

  // Mark as verified
  await db
    .update(otpCodes)
    .set({ verifiedAt: now })
    .where(eq(otpCodes.id, otp.id));

  // If OTP has a personId (new path), look up their businesses
  if (otp.personId) {
    const memberships = await db
      .select({
        clientId: clientMemberships.clientId,
        businessName: clients.businessName,
      })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(
        and(
          eq(clientMemberships.personId, otp.personId),
          eq(clientMemberships.isActive, true),
          eq(clients.status, 'active')
        )
      );

    if (memberships.length === 1) {
      return {
        success: true,
        personId: otp.personId,
        clientId: memberships[0].clientId,
        businesses: memberships,
      };
    }

    if (memberships.length > 1) {
      return {
        success: true,
        personId: otp.personId,
        businesses: memberships,
      };
    }
  }

  // Legacy path: return clientId directly
  return { success: true, clientId: otp.clientId ?? undefined };
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
