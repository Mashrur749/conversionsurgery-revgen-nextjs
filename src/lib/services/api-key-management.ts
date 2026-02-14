import { getDb } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key for a client.
 * Returns the plaintext key ONCE — it cannot be retrieved later.
 */
export async function createApiKey(
  clientId: string,
  label: string,
  scopes: string[] = [],
  expiresAt?: Date
): Promise<{ id: string; key: string; prefix: string }> {
  const rawKey = `cs_${randomBytes(32).toString('hex')}`;
  const prefix = rawKey.substring(0, 7);
  const keyHash = hashKey(rawKey);

  const db = getDb();
  const [record] = await db
    .insert(apiKeys)
    .values({
      clientId,
      label,
      keyHash,
      keyPrefix: prefix,
      scopes,
      expiresAt: expiresAt || null,
    })
    .returning();

  return { id: record.id, key: rawKey, prefix };
}

/**
 * Validate an API key. Returns client context if valid, null if not.
 */
export async function validateApiKey(
  key: string
): Promise<{ clientId: string; scopes: string[] } | null> {
  const keyHash = hashKey(key);
  const db = getDb();

  const [record] = await db
    .select({
      id: apiKeys.id,
      clientId: apiKeys.clientId,
      scopes: apiKeys.scopes,
      isActive: apiKeys.isActive,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!record || !record.isActive) return null;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;

  // Update last used timestamp (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id))
    .catch(() => {});

  return {
    clientId: record.clientId,
    scopes: (record.scopes as string[]) || [],
  };
}

/**
 * Revoke an API key by setting it inactive.
 */
export async function revokeApiKey(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(apiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

/**
 * List all API keys for a client (without the actual key hash).
 */
export async function listApiKeys(clientId: string) {
  const db = getDb();
  return db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.clientId, clientId))
    .orderBy(apiKeys.createdAt);
}
