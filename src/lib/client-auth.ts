import { cookies } from 'next/headers';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';

const COOKIE_NAME = 'clientSessionId';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSigningSecret(): string {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (!secret) {
    throw new Error('CLIENT_SESSION_SECRET environment variable is required');
  }
  return secret;
}

/** HMAC-sign a clientId to produce a tamper-proof cookie value: `clientId.signature` */
export async function signClientSession(clientId: string): Promise<string> {
  const secret = getSigningSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(clientId));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${clientId}.${sigHex}`;
}

/** Verify a signed cookie value. Returns the clientId if valid, null otherwise. */
async function verifyClientSession(cookieValue: string): Promise<string | null> {
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const clientId = cookieValue.slice(0, dotIndex);
  const providedSig = cookieValue.slice(dotIndex + 1);

  // Re-sign and compare (constant-time via subtle.verify)
  const secret = getSigningSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Convert hex sig back to bytes
  const sigBytes = new Uint8Array(
    providedSig.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(clientId)
  );

  return valid ? clientId : null;
}

/** Set the signed client session cookie. Call this after OTP verification. */
export async function setClientSessionCookie(clientId: string): Promise<void> {
  const signed = await signClientSession(clientId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

/** Clear the client session cookie. */
export async function clearClientSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Get the authenticated client session from the signed cookie. */
export async function getClientSession(): Promise<{
  clientId: string;
  client: typeof clients.$inferSelect;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return null;
  }

  const clientId = await verifyClientSession(raw);
  if (!clientId) {
    return null;
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return null;
  }

  return { clientId, client };
}
