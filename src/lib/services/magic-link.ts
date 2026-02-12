import { getDb, magicLinkTokens } from '@/db';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';

/** Generate a cryptographically secure 64-character hex token */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/** Create a magic link for client dashboard access (valid 7 days) */
export async function createMagicLink(clientId: string): Promise<string> {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await db.insert(magicLinkTokens).values({
    clientId,
    token,
    expiresAt,
  });

  return `${process.env.NEXT_PUBLIC_APP_URL}/d/${token}`;
}

/** Validate a magic link token and return the associated client ID */
export async function validateMagicLink(token: string): Promise<{
  valid: boolean;
  clientId?: string;
  error?: string;
}> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(magicLinkTokens)
    .where(and(
      eq(magicLinkTokens.token, token),
      gt(magicLinkTokens.expiresAt, new Date())
    ))
    .limit(1);

  if (!record) {
    return { valid: false, error: 'Invalid or expired link' };
  }

  // Mark as used (but don't invalidate - allow reuse within expiry)
  if (!record.usedAt) {
    await db
      .update(magicLinkTokens)
      .set({ usedAt: new Date() })
      .where(eq(magicLinkTokens.id, record.id));
  }

  return { valid: true, clientId: record.clientId };
}

/** Send a dashboard magic link to a client via SMS */
export async function sendDashboardLink(clientId: string, phone: string, twilioNumber: string): Promise<void> {
  const { sendSMS } = await import('@/lib/services/twilio');

  const link = await createMagicLink(clientId);

  await sendSMS(
    phone,
    `Here's your dashboard link (valid for 7 days):\n${link}`,
    twilioNumber
  );
}
