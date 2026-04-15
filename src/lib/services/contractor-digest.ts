/**
 * Contractor Digest Service
 *
 * Aggregates pending P2 items (KB gaps, stale estimates, post-appointment
 * won/lost prompts) into a single daily SMS per contractor.
 *
 * Replaces 40-60 individual SMS/month with one daily batch.
 *
 * Items types and reply syntax:
 * - kb_gap: plain number → reply with answer text
 * - estimate_prompt: N=YES → confirms estimate sent
 * - won_lost_prompt: WN / LN → mark won or lost
 *
 * Cap: 8 items max per digest to keep SMS readable.
 */

import { getDb } from '@/db';
import { knowledgeGaps, leads, appointments, auditLog } from '@/db/schema';
import { eq, and, notInArray, inArray, lt, lte, desc, gte } from 'drizzle-orm';

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTIMATE_STALE_DAYS = 14;
const APPOINTMENT_AGE_DAYS = 7;
const MAX_DIGEST_ITEMS = 8;
const RESOLVED_STATUSES = ['won', 'lost', 'closed'] as const;
const DIGEST_DEDUP_HOURS = 48;

// ── Types ─────────────────────────────────────────────────────────────────────

export type DigestItemType = 'kb_gap' | 'estimate_prompt' | 'won_lost_prompt';

export interface DigestItem {
  type: DigestItemType;
  id: string; // leadId or knowledgeGapId
  label: string; // display text (name, question, etc.)
}

export interface DigestResult {
  items: DigestItem[];
}

// ── Build digest ──────────────────────────────────────────────────────────────

/**
 * Query all pending P2 items for a client and return a structured digest.
 * Returns null if there are no items (empty digest = no SMS).
 */
export async function buildDigest(clientId: string): Promise<DigestResult | null> {
  const db = getDb();
  const now = new Date();
  const items: DigestItem[] = [];

  // ── 0. Dedup: fetch item IDs already included in a digest in the last 48h ─
  const dedupCutoff = new Date(now.getTime() - DIGEST_DEDUP_HOURS * 60 * 60 * 1000);

  const recentlyDigested = await db
    .select({ resourceId: auditLog.resourceId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.clientId, clientId),
        eq(auditLog.action, 'digest_item_included'),
        gte(auditLog.createdAt, dedupCutoff)
      )
    );

  const recentlyDigestedIds = new Set(
    recentlyDigested.map((r) => r.resourceId).filter((id): id is string => id !== null)
  );

  // ── 1. KB gaps (status = 'new', ordered by priorityScore desc) ───────────
  const recentlyDigestedIdsArray = [...recentlyDigestedIds];

  const gapWhere =
    recentlyDigestedIdsArray.length > 0
      ? and(
          eq(knowledgeGaps.clientId, clientId),
          eq(knowledgeGaps.status, 'new'),
          notInArray(knowledgeGaps.id, recentlyDigestedIdsArray)
        )
      : and(eq(knowledgeGaps.clientId, clientId), eq(knowledgeGaps.status, 'new'));

  const gaps = await db
    .select({
      id: knowledgeGaps.id,
      question: knowledgeGaps.question,
    })
    .from(knowledgeGaps)
    .where(gapWhere)
    .orderBy(desc(knowledgeGaps.priorityScore))
    .limit(MAX_DIGEST_ITEMS);

  for (const gap of gaps) {
    items.push({
      type: 'kb_gap',
      id: gap.id,
      label: gap.question,
    });
  }

  // ── 2. Stale estimate_sent leads (14+ days, unresolved) ──────────────────
  const estimateCutoff = new Date(now.getTime() - ESTIMATE_STALE_DAYS * 24 * 60 * 60 * 1000);

  const staleEstimates = await db
    .select({
      id: leads.id,
      name: leads.name,
    })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'estimate_sent'),
        lt(leads.updatedAt, estimateCutoff)
      )
    )
    .limit(MAX_DIGEST_ITEMS);

  for (const lead of staleEstimates) {
    if (!recentlyDigestedIds.has(lead.id)) {
      items.push({
        type: 'estimate_prompt',
        id: lead.id,
        label: abbreviateName(lead.name),
      });
    }
  }

  // ── 3. Post-appointment unresolved leads (7+ days old appointment) ───────
  const appointmentCutoff = new Date(now.getTime() - APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDate = appointmentCutoff.toISOString().split('T')[0];

  const qualifyingAppointments = await db
    .select({
      leadId: appointments.leadId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        inArray(appointments.status, ['completed', 'confirmed']),
        lte(appointments.appointmentDate, cutoffDate)
      )
    );

  const appointmentLeadIds = [...new Set(qualifyingAppointments.map((a) => a.leadId))];

  if (appointmentLeadIds.length > 0) {
    // Exclude leads already in stale estimates (dedup across type)
    const estimateLeadIds = new Set(
      items.filter((i) => i.type === 'estimate_prompt').map((i) => i.id)
    );

    const unresolvedLeadIds = appointmentLeadIds.filter(
      (id) => !estimateLeadIds.has(id) && !recentlyDigestedIds.has(id)
    );

    if (unresolvedLeadIds.length > 0) {
      const unresolvedLeads = await db
        .select({
          id: leads.id,
          name: leads.name,
        })
        .from(leads)
        .where(
          and(
            inArray(leads.id, unresolvedLeadIds),
            notInArray(leads.status, [...RESOLVED_STATUSES])
          )
        )
        .limit(MAX_DIGEST_ITEMS);

      for (const lead of unresolvedLeads) {
        items.push({
          type: 'won_lost_prompt',
          id: lead.id,
          label: abbreviateName(lead.name),
        });
      }
    }
  }

  if (items.length === 0) return null;

  // Cap at MAX_DIGEST_ITEMS
  const cappedItems = items.slice(0, MAX_DIGEST_ITEMS);

  // ── Dedup write: mark each included item so it won't reappear for 48h ────
  if (cappedItems.length > 0) {
    await db.insert(auditLog).values(
      cappedItems.map((item) => ({
        clientId,
        action: 'digest_item_included' as const,
        resourceType: item.type,
        resourceId: item.id,
        metadata: { label: item.label } as Record<string, unknown>,
      }))
    );
  }

  return { items: cappedItems };
}

// ── Format digest SMS ─────────────────────────────────────────────────────────

/**
 * Format a digest into an SMS string with numbered reply syntax.
 *
 * KB gaps use plain numbers: `3. "question?" Reply with answer`
 * Estimate prompts use N=YES: `1. Sarah T — sent quote? Reply 1=YES`
 * Won/lost prompts use WN/LN: `2. Mike R — won or lost? Reply W2 or L2`
 */
export function formatDigestSms(businessName: string, items: DigestItem[]): string {
  const lines: string[] = [`Morning update for ${businessName}:`];

  // Group items by type for section headers
  const estimateItems = items
    .map((item, idx) => ({ ...item, num: idx + 1 }))
    .filter((i) => i.type === 'estimate_prompt');

  const wonLostItems = items
    .map((item, idx) => ({ ...item, num: idx + 1 }))
    .filter((i) => i.type === 'won_lost_prompt');

  const kbItems = items
    .map((item, idx) => ({ ...item, num: idx + 1 }))
    .filter((i) => i.type === 'kb_gap');

  const leadItems = [...estimateItems, ...wonLostItems];

  // Leads section
  if (leadItems.length > 0) {
    lines.push('');
    lines.push(`${leadItems.length} lead${leadItems.length === 1 ? '' : 's'} need${leadItems.length === 1 ? 's' : ''} input:`);
    for (const item of estimateItems) {
      lines.push(`  ${item.num}. ${item.label} — sent quote? Reply ${item.num}=YES`);
    }
    for (const item of wonLostItems) {
      lines.push(`  ${item.num}. ${item.label} — won or lost? Reply W${item.num} or L${item.num}`);
    }
  }

  // KB gaps section
  if (kbItems.length > 0) {
    lines.push('');
    lines.push(`${kbItems.length} question${kbItems.length === 1 ? '' : 's'} from a homeowner:`);
    for (const item of kbItems) {
      // Truncate long questions
      const question = item.label.length > 60 ? item.label.slice(0, 57) + '...' : item.label;
      lines.push(`  ${item.num}. "${question}" Reply with answer`);
    }
  }

  lines.push('');
  lines.push('Reply 0 to skip all.');

  return lines.join('\n');
}

// ── Action payload builder ────────────────────────────────────────────────────

/**
 * Build the actionPayload for the digest message.
 * Includes item types so reply parsing can route correctly.
 */
export function buildDigestActionPayload(items: DigestItem[]): Record<string, unknown> {
  return {
    interactionType: 'daily_digest',
    options: items.map((item, idx) => ({
      index: idx + 1,
      type: item.type,
      id: item.id,
      label: item.label,
    })),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Abbreviate a name to first name + last initial. Fallback to "Lead". */
function abbreviateName(name: string | null): string {
  if (!name) return 'Lead';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
