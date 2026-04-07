import { getDb } from '@/db';
import { agencies } from '@/db/schema';

/**
 * Get the singleton agency record, creating it if it doesn't exist.
 * Single-tenant: there's exactly one agency row.
 */
export async function getAgency() {
  const db = getDb();
  const [row] = await db.select().from(agencies).limit(1);
  if (row) return row;

  // Auto-create on first access — operator should update name via settings
  const [created] = await db.insert(agencies).values({ name: 'My Agency' }).returning();
  return created;
}

/** Shortcut: get a single agency field. */
export async function getAgencyField<K extends keyof typeof agencies.$inferSelect>(
  field: K,
): Promise<(typeof agencies.$inferSelect)[K]> {
  const agency = await getAgency();
  return agency[field];
}
