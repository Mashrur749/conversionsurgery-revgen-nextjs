import { eq, and, sql, isNotNull, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { leads } from '@/db/schema';

/**
 * Generates short, human-readable reference codes for lead outcome tracking.
 * Codes are base-36 uppercase (0-9, A-Z), unique per client, assigned lazily.
 *
 * Contractors use these in SMS commands: "WON 4A" or "LOST 3B".
 * The codes are short enough to include in SMS messages without eating into
 * the 160-char segment budget.
 */

function toBase36Upper(n: number): string {
  return n.toString(36).toUpperCase();
}

function fromBase36Upper(s: string): number {
  return parseInt(s, 36);
}

/**
 * Generate the next available ref code for a client.
 * Uses sequential base-36 assignment: 1, 2, ..., 9, A, B, ..., Z, 10, 11, ...
 */
export async function generateOutcomeRefCode(clientId: string): Promise<string> {
  const db = getDb();

  // Find the highest existing ref code for this client
  const [maxRow] = await db
    .select({ outcomeRefCode: leads.outcomeRefCode })
    .from(leads)
    .where(and(eq(leads.clientId, clientId), isNotNull(leads.outcomeRefCode)))
    .orderBy(desc(sql`length(${leads.outcomeRefCode})`), desc(leads.outcomeRefCode))
    .limit(1);

  if (!maxRow?.outcomeRefCode) {
    return '1'; // First code for this client
  }

  const currentMax = fromBase36Upper(maxRow.outcomeRefCode);
  return toBase36Upper(currentMax + 1);
}

/**
 * Ensure a lead has a ref code. Returns existing code if already assigned,
 * otherwise generates and stores a new one.
 *
 * This is the primary entrypoint — call this wherever a ref code is needed.
 */
export async function ensureOutcomeRefCode(
  leadId: string,
  clientId: string
): Promise<string> {
  const db = getDb();

  // Check if already assigned
  const [existing] = await db
    .select({ outcomeRefCode: leads.outcomeRefCode })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (existing?.outcomeRefCode) {
    return existing.outcomeRefCode;
  }

  // Generate and assign
  const refCode = await generateOutcomeRefCode(clientId);

  try {
    await db
      .update(leads)
      .set({ outcomeRefCode: refCode, updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  } catch {
    // Unique constraint violation — another request generated the same code.
    // Re-read the lead to get whatever code was assigned.
    const [retry] = await db
      .select({ outcomeRefCode: leads.outcomeRefCode })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (retry?.outcomeRefCode) {
      return retry.outcomeRefCode;
    }

    // If still null, try once more with a fresh code
    const retryCode = await generateOutcomeRefCode(clientId);
    await db
      .update(leads)
      .set({ outcomeRefCode: retryCode, updatedAt: new Date() })
      .where(eq(leads.id, leadId));
    return retryCode;
  }

  return refCode;
}

/**
 * Look up a lead by ref code within a client.
 */
export async function resolveLeadByRefCode(
  clientId: string,
  refCode: string
): Promise<{
  id: string;
  name: string | null;
  phone: string;
  status: string | null;
  projectType: string | null;
  confirmedRevenue: number | null;
} | null> {
  const db = getDb();

  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      status: leads.status,
      projectType: leads.projectType,
      confirmedRevenue: leads.confirmedRevenue,
    })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.outcomeRefCode, refCode.toUpperCase())
      )
    )
    .limit(1);

  return lead ?? null;
}
