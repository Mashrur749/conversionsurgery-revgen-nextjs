/**
 * Session invalidation utilities.
 * Increment sessionVersion on memberships to force re-authentication.
 */
import { getDb } from '@/db';
import { clientMemberships, agencyMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Increment sessionVersion on a client membership.
 * The user's next request will fail the sessionVersion check
 * and they'll be logged out.
 */
export async function invalidateClientSession(
  membershipId: string
): Promise<void> {
  const db = getDb();
  await db
    .update(clientMemberships)
    .set({ sessionVersion: sql`session_version + 1` })
    .where(eq(clientMemberships.id, membershipId));
}

/**
 * Increment sessionVersion on an agency membership.
 */
export async function invalidateAgencySession(
  membershipId: string
): Promise<void> {
  const db = getDb();
  await db
    .update(agencyMemberships)
    .set({ sessionVersion: sql`session_version + 1` })
    .where(eq(agencyMemberships.id, membershipId));
}
