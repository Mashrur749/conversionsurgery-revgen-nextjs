import { cookies } from 'next/headers';
import { getDb, clients } from '@/db';
import { clientMemberships, roleTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolvePermissions } from '@/lib/permissions/resolve';
import type { PermissionOverrides } from '@/lib/permissions/resolve';

const COOKIE_NAME = 'clientSessionId';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSigningSecret(): string {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (!secret) {
    throw new Error('CLIENT_SESSION_SECRET environment variable is required');
  }
  return secret;
}

/** HMAC-sign a payload to produce a tamper-proof cookie value: `base64payload.signature` */
async function signPayload(payload: string): Promise<string> {
  const secret = getSigningSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payload}.${sigHex}`;
}

/** Verify a signed cookie value. Returns the payload if valid, null otherwise. */
async function verifyPayload(cookieValue: string): Promise<string | null> {
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payload = cookieValue.slice(0, dotIndex);
  const providedSig = cookieValue.slice(dotIndex + 1);

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
    encoder.encode(payload)
  );

  return valid ? payload : null;
}

/**
 * Cookie payload for the new session format.
 * Contains personId + clientId + permissions for stateless permission checks.
 */
interface SessionPayload {
  personId: string;
  clientId: string;
  permissions: string[];
  sessionVersion: number;
}

/**
 * Set the new-format signed client session cookie with permissions.
 * Called after OTP verification + business selection.
 */
export async function setClientSessionCookieWithPermissions(
  personId: string,
  clientId: string
): Promise<void> {
  const db = getDb();

  // Load membership + role template to get permissions
  const [membership] = await db
    .select({
      roleTemplateId: clientMemberships.roleTemplateId,
      permissionOverrides: clientMemberships.permissionOverrides,
      sessionVersion: clientMemberships.sessionVersion,
    })
    .from(clientMemberships)
    .where(
      and(
        eq(clientMemberships.personId, personId),
        eq(clientMemberships.clientId, clientId),
        eq(clientMemberships.isActive, true)
      )
    )
    .limit(1);

  if (!membership) throw new Error('No active membership found');

  const [template] = await db
    .select({ permissions: roleTemplates.permissions })
    .from(roleTemplates)
    .where(eq(roleTemplates.id, membership.roleTemplateId))
    .limit(1);

  if (!template) throw new Error('Role template not found');

  const overrides = membership.permissionOverrides as PermissionOverrides | null;
  const resolved = resolvePermissions(template.permissions, overrides);

  const payload: SessionPayload = {
    personId,
    clientId,
    permissions: Array.from(resolved),
    sessionVersion: membership.sessionVersion,
  };

  const encoded = btoa(JSON.stringify(payload));
  const signed = await signPayload(encoded);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

/** Set the legacy signed client session cookie (clientId only). */
export async function setClientSessionCookie(clientId: string): Promise<void> {
  const signed = await signPayload(clientId);
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

/** Legacy session result (clientId only) */
interface LegacySession {
  clientId: string;
  client: typeof clients.$inferSelect;
}

/** New session result with permissions */
interface NewSession {
  clientId: string;
  personId: string;
  permissions: string[];
  sessionVersion: number;
  client: typeof clients.$inferSelect;
}

/**
 * Get the authenticated client session from the signed cookie.
 * Supports both new format (base64 JSON with permissions) and
 * legacy format (clientId only).
 */
export async function getClientSession(): Promise<(LegacySession | NewSession) | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return null;
  }

  const payload = await verifyPayload(raw);
  if (!payload) {
    return null;
  }

  // Try to decode as new format (base64 JSON)
  try {
    const decoded = JSON.parse(atob(payload)) as SessionPayload;
    if (decoded.personId && decoded.clientId && Array.isArray(decoded.permissions)) {
      // New format — verify sessionVersion
      const db = getDb();
      const [membership] = await db
        .select({ sessionVersion: clientMemberships.sessionVersion })
        .from(clientMemberships)
        .where(
          and(
            eq(clientMemberships.personId, decoded.personId),
            eq(clientMemberships.clientId, decoded.clientId),
            eq(clientMemberships.isActive, true)
          )
        )
        .limit(1);

      if (!membership || membership.sessionVersion > decoded.sessionVersion) {
        // Session invalidated — clear cookie
        await clearClientSessionCookie();
        return null;
      }

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, decoded.clientId))
        .limit(1);

      if (!client) return null;

      return {
        clientId: decoded.clientId,
        personId: decoded.personId,
        permissions: decoded.permissions,
        sessionVersion: decoded.sessionVersion,
        client,
      };
    }
  } catch {
    // Not base64 JSON — fall through to legacy format
  }

  // Legacy format: payload is just clientId
  const clientId = payload;
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
