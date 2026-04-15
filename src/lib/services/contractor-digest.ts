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
const DIGEST_DEDUP_HOURS = 24;

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

  // ── 0. Dedup: fetch item IDs already included in a digest in the last 24h ─
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

  // ── 1. Query all types independently ──────────────────────────────────────
  const recentlyDigestedIdsArray = [...recentlyDigestedIds];

  // 1a. KB gaps
  const gapWhere =
    recentlyDigestedIdsArray.length > 0
      ? and(
          eq(knowledgeGaps.clientId, clientId),
          eq(knowledgeGaps.status, 'new'),
          notInArray(knowledgeGaps.id, recentlyDigestedIdsArray)
        )
      : and(eq(knowledgeGaps.clientId, clientId), eq(knowledgeGaps.status, 'new'));

  const gaps = await db
    .select({ id: knowledgeGaps.id, question: knowledgeGaps.question })
    .from(knowledgeGaps)
    .where(gapWhere)
    .orderBy(desc(knowledgeGaps.priorityScore))
    .limit(MAX_DIGEST_ITEMS);

  const kbItems: DigestItem[] = gaps.map((gap) => ({
    type: 'kb_gap' as const,
    id: gap.id,
    label: gap.question,
  }));

  // 1b. Stale estimate_sent leads
  const estimateCutoff = new Date(now.getTime() - ESTIMATE_STALE_DAYS * 24 * 60 * 60 * 1000);

  const staleEstimates = await db
    .select({ id: leads.id, name: leads.name })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'estimate_sent'),
        lt(leads.updatedAt, estimateCutoff)
      )
    )
    .limit(MAX_DIGEST_ITEMS);

  const estimateItems: DigestItem[] = staleEstimates
    .filter((lead) => !recentlyDigestedIds.has(lead.id))
    .map((lead) => ({
      type: 'estimate_prompt' as const,
      id: lead.id,
      label: abbreviateName(lead.name),
    }));

  // 1c. Post-appointment unresolved leads
  const appointmentCutoff = new Date(now.getTime() - APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDate = appointmentCutoff.toISOString().split('T')[0];

  const qualifyingAppointments = await db
    .select({ leadId: appointments.leadId })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        inArray(appointments.status, ['completed', 'confirmed']),
        lte(appointments.appointmentDate, cutoffDate)
      )
    );

  const appointmentLeadIds = [...new Set(qualifyingAppointments.map((a) => a.leadId))];
  let wonLostItems: DigestItem[] = [];

  if (appointmentLeadIds.length > 0) {
    const estimateLeadIds = new Set(estimateItems.map((i) => i.id));
    const unresolvedLeadIds = appointmentLeadIds.filter(
      (id) => !estimateLeadIds.has(id) && !recentlyDigestedIds.has(id)
    );

    if (unresolvedLeadIds.length > 0) {
      const unresolvedLeads = await db
        .select({ id: leads.id, name: leads.name })
        .from(leads)
        .where(
          and(
            inArray(leads.id, unresolvedLeadIds),
            notInArray(leads.status, [...RESOLVED_STATUSES])
          )
        )
        .limit(MAX_DIGEST_ITEMS);

      wonLostItems = unresolvedLeads.map((lead) => ({
        type: 'won_lost_prompt' as const,
        id: lead.id,
        label: abbreviateName(lead.name),
      }));
    }
  }

  // ── 2. Priority-balanced slot allocation ──────────────────────────────────
  const wonLostSlots = Math.min(2, wonLostItems.length);
  const estimateSlots = Math.min(2, estimateItems.length);
  const kbSlots = MAX_DIGEST_ITEMS - wonLostSlots - estimateSlots;

  const items: DigestItem[] = [
    ...wonLostItems.slice(0, wonLostSlots),
    ...estimateItems.slice(0, estimateSlots),
    ...kbItems.slice(0, kbSlots),
  ];

  // Fill remaining slots if any type had fewer items than reserved
  const remaining = MAX_DIGEST_ITEMS - items.length;
  if (remaining > 0) {
    const usedIds = new Set(items.map((i) => i.id));
    const overflow = [
      ...wonLostItems.filter((i) => !usedIds.has(i.id)),
      ...estimateItems.filter((i) => !usedIds.has(i.id)),
      ...kbItems.filter((i) => !usedIds.has(i.id)),
    ];
    items.push(...overflow.slice(0, remaining));
  }

  if (items.length === 0) return null;

  // ── Dedup write: mark each included item so it won't reappear for 24h ────
  if (items.length > 0) {
    await db.insert(auditLog).values(
      items.map((item) => ({
        clientId,
        action: 'digest_item_included' as const,
        resourceType: item.type,
        resourceId: item.id,
        metadata: { label: item.label } as Record<string, unknown>,
      }))
    );
  }

  return { items };
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
