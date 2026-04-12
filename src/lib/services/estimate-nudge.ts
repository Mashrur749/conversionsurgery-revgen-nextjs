import { getDb } from '@/db';
import { agencyMessages, clients, leads, scheduledMessages } from '@/db/schema';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const MS_IN_HOUR = 60 * 60 * 1000;

export const ESTIMATE_NUDGE_STALE_DAYS = 1;
export const ESTIMATE_NUDGE_COOLDOWN_HOURS = 72;

export interface EstimateNudgeLead {
  clientId: string;
  clientName: string;
  ownerPhone: string;
  twilioNumber: string;
  leadId: string;
  leadName: string | null;
  leadPhone: string;
}

interface EstimateNudgeEligibilityInput {
  status: string | null;
  updatedAt: Date;
  optedOut: boolean;
  hasActiveEstimateSequence: boolean;
  nudgedWithinCooldown: boolean;
  now: Date;
}

export function isLeadEligibleForEstimateNudge(
  input: EstimateNudgeEligibilityInput
): boolean {
  if (input.status !== 'contacted') return false;
  if (input.optedOut) return false;
  if (input.hasActiveEstimateSequence) return false;
  if (input.nudgedWithinCooldown) return false;

  const staleCutoff = new Date(
    input.now.getTime() - ESTIMATE_NUDGE_STALE_DAYS * MS_IN_DAY
  );
  if (input.updatedAt > staleCutoff) return false;

  return true;
}

export async function findEstimateNudgeEligibleLeads(
  now: Date = new Date()
): Promise<EstimateNudgeLead[]> {
  const db = getDb();
  const staleCutoff = new Date(now.getTime() - ESTIMATE_NUDGE_STALE_DAYS * MS_IN_DAY);
  const cooldownCutoff = new Date(
    now.getTime() - ESTIMATE_NUDGE_COOLDOWN_HOURS * MS_IN_HOUR
  );

  const candidateRows = await db
    .select({
      clientId: clients.id,
      clientName: clients.businessName,
      ownerPhone: clients.phone,
      twilioNumber: clients.twilioNumber,
      leadId: leads.id,
      leadName: leads.name,
      leadPhone: leads.phone,
      leadStatus: leads.status,
      leadOptedOut: leads.optedOut,
      leadUpdatedAt: leads.updatedAt,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(
      and(
        eq(clients.status, 'active'),
        eq(leads.status, 'contacted'),
        eq(leads.optedOut, false),
        lte(leads.updatedAt, staleCutoff)
      )
    )
    .limit(200);

  if (candidateRows.length === 0) {
    return [];
  }

  const leadIds = candidateRows.map((row) => row.leadId);
  const clientIds = Array.from(new Set(candidateRows.map((row) => row.clientId)));

  const activeSequenceRows = await db
    .select({ leadId: scheduledMessages.leadId })
    .from(scheduledMessages)
    .where(
      and(
        inArray(scheduledMessages.leadId, leadIds),
        eq(scheduledMessages.sequenceType, 'estimate_followup'),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      )
    );
  const activeSequenceLeadIds = new Set(activeSequenceRows.map((row) => row.leadId));

  const recentPromptRows = await db
    .select({
      clientId: agencyMessages.clientId,
      actionPayload: agencyMessages.actionPayload,
    })
    .from(agencyMessages)
    .where(
      and(
        inArray(agencyMessages.clientId, clientIds),
        eq(agencyMessages.promptType, 'start_sequences'),
        gte(agencyMessages.createdAt, cooldownCutoff)
      )
    );

  const recentlyNudgedLeadKeys = new Set<string>();
  for (const row of recentPromptRows) {
    const payload = row.actionPayload as Record<string, unknown> | null;
    if (!payload) continue;
    if (payload.source !== 'fallback_nudge') continue;
    const leadId = typeof payload.leadId === 'string' ? payload.leadId : null;
    if (!leadId) continue;
    recentlyNudgedLeadKeys.add(`${row.clientId}:${leadId}`);
  }

  return candidateRows
    .filter((row) =>
      isLeadEligibleForEstimateNudge({
        status: row.leadStatus,
        updatedAt: row.leadUpdatedAt,
        optedOut: row.leadOptedOut ?? false,
        hasActiveEstimateSequence: activeSequenceLeadIds.has(row.leadId),
        nudgedWithinCooldown: recentlyNudgedLeadKeys.has(`${row.clientId}:${row.leadId}`),
        now,
      })
    )
    .filter((row): row is typeof row & { ownerPhone: string; twilioNumber: string } =>
      Boolean(row.ownerPhone && row.twilioNumber)
    )
    .map((row) => ({
      clientId: row.clientId,
      clientName: row.clientName,
      ownerPhone: row.ownerPhone,
      twilioNumber: row.twilioNumber,
      leadId: row.leadId,
      leadName: row.leadName,
      leadPhone: row.leadPhone,
    }));
}

export function buildEstimateFallbackNudgeMessage(
  clientName: string,
  leadName: string | null,
  leadPhone: string
): string {
  const leadLabel = leadName ? `${leadName} (${leadPhone})` : leadPhone;
  return `Quick check for ${clientName}: did you send an estimate to ${leadLabel}? Reply YES to start follow-up or NO to skip.`;
}
