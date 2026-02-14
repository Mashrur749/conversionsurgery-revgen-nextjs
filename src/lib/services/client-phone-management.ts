import { getDb } from '@/db';
import { clientPhoneNumbers, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Add a phone number to a client. If it's the first number, mark as primary.
 */
export async function addNumber(
  clientId: string,
  phoneNumber: string,
  options?: {
    friendlyName?: string;
    isPrimary?: boolean;
    capabilities?: { sms: boolean; voice: boolean; mms: boolean };
  }
) {
  const db = getDb();

  // Check if this is the first number
  const existing = await db
    .select({ id: clientPhoneNumbers.id })
    .from(clientPhoneNumbers)
    .where(
      and(
        eq(clientPhoneNumbers.clientId, clientId),
        eq(clientPhoneNumbers.isActive, true)
      )
    )
    .limit(1);

  const isPrimary = options?.isPrimary ?? existing.length === 0;

  // If setting as primary, unset any existing primary
  if (isPrimary) {
    await db
      .update(clientPhoneNumbers)
      .set({ isPrimary: false })
      .where(eq(clientPhoneNumbers.clientId, clientId));
  }

  const [record] = await db
    .insert(clientPhoneNumbers)
    .values({
      clientId,
      phoneNumber,
      friendlyName: options?.friendlyName || null,
      isPrimary,
      capabilities: options?.capabilities || { sms: true, voice: true, mms: true },
      purchasedAt: new Date(),
    })
    .returning();

  // Sync primary to clients.twilioNumber
  if (isPrimary) {
    await db
      .update(clients)
      .set({ twilioNumber: phoneNumber, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  }

  return record;
}

/**
 * Remove (deactivate) a phone number from a client.
 */
export async function removeNumber(id: string) {
  const db = getDb();
  const [record] = await db
    .update(clientPhoneNumbers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(clientPhoneNumbers.id, id))
    .returning();

  // If this was the primary, promote the next active number
  if (record?.isPrimary && record.clientId) {
    const [next] = await db
      .select()
      .from(clientPhoneNumbers)
      .where(
        and(
          eq(clientPhoneNumbers.clientId, record.clientId),
          eq(clientPhoneNumbers.isActive, true)
        )
      )
      .limit(1);

    if (next) {
      await db
        .update(clientPhoneNumbers)
        .set({ isPrimary: true })
        .where(eq(clientPhoneNumbers.id, next.id));
      await db
        .update(clients)
        .set({ twilioNumber: next.phoneNumber, updatedAt: new Date() })
        .where(eq(clients.id, record.clientId));
    } else {
      // No active numbers left
      await db
        .update(clients)
        .set({ twilioNumber: null, updatedAt: new Date() })
        .where(eq(clients.id, record.clientId));
    }
  }

  return record;
}

/**
 * Set a number as primary for its client.
 */
export async function setPrimary(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(clientPhoneNumbers)
    .where(eq(clientPhoneNumbers.id, id))
    .limit(1);

  if (!record) return null;

  // Unset all other primaries for this client
  await db
    .update(clientPhoneNumbers)
    .set({ isPrimary: false })
    .where(eq(clientPhoneNumbers.clientId, record.clientId));

  // Set this one
  await db
    .update(clientPhoneNumbers)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(eq(clientPhoneNumbers.id, id));

  // Sync to clients.twilioNumber
  await db
    .update(clients)
    .set({ twilioNumber: record.phoneNumber, updatedAt: new Date() })
    .where(eq(clients.id, record.clientId));

  return record;
}

/**
 * Get all phone numbers for a client.
 */
export async function getNumbers(clientId: string) {
  const db = getDb();
  return db
    .select()
    .from(clientPhoneNumbers)
    .where(
      and(
        eq(clientPhoneNumbers.clientId, clientId),
        eq(clientPhoneNumbers.isActive, true)
      )
    )
    .orderBy(clientPhoneNumbers.createdAt);
}

/**
 * Find the client who owns a given phone number.
 * Checks the junction table first, falls back to clients.twilioNumber.
 */
export async function findClientByPhoneNumber(phoneNumber: string) {
  const db = getDb();

  // Check junction table first
  const [record] = await db
    .select({
      clientId: clientPhoneNumbers.clientId,
      isPrimary: clientPhoneNumbers.isPrimary,
    })
    .from(clientPhoneNumbers)
    .where(
      and(
        eq(clientPhoneNumbers.phoneNumber, phoneNumber),
        eq(clientPhoneNumbers.isActive, true)
      )
    )
    .limit(1);

  if (record) return record.clientId;

  // Fallback to clients.twilioNumber
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.twilioNumber, phoneNumber))
    .limit(1);

  return client?.id || null;
}
