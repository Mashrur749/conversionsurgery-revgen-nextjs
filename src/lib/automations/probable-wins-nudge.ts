/**
 * Probable Wins Nudge Automation
 *
 * Auto-Detect Probable Wins
 *
 * Sends an internal SMS to contractors asking them to confirm job outcomes
 * when an appointment was completed 7+ days ago but the lead status is
 * still unresolved. Includes outcome reference codes so contractors can
 * reply WON/LOST directly to their business number.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — it goes through
 * sendActionPrompt (agency channel), NOT the compliance gateway.
 *
 * Runs daily via the cron orchestrator.
 *
 * Rules:
 * - Lead status must NOT be won, lost, or closed
 * - Qualifying via EITHER:
 *     a) At least one completed/confirmed appointment that is 7+ days old
 *     b) status = 'estimate_sent' with updatedAt 14+ days ago
 * - No won_lost_nudge prompt sent to this client in the last 7 days
 *   (checked via agencyMessages with promptType = 'won_lost_nudge')
 * - Client must be active and have a phone number
 * - At most 1 nudge per lead per client per run (deduped by leadId)
 * - Both lead types appear in the same batched message, capped at 5 per client
 */

import { getDb } from '@/db';
import { leads, clients, appointments, agencyMessages } from '@/db/schema';
import { eq, and, notInArray, inArray, gte, lte, lt } from 'drizzle-orm';
import { sendActionPrompt } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { ensureOutcomeRefCode } from '@/lib/services/outcome-ref-codes';

// ── Constants ─────────────────────────────────────────────────────────────────

const APPOINTMENT_AGE_DAYS = 7;
const ESTIMATE_STALE_DAYS = 14;
const NUDGE_COOLDOWN_DAYS = 7;

// Statuses that mean the lead is already resolved
const RESOLVED_STATUSES = ['won', 'lost', 'closed'] as const;

// ── Message builders ──────────────────────────────────────────────────────────

interface NudgeLead {
  id: string;
  name: string | null;
  projectType: string | null;
}

function buildLeadLabel(lead: NudgeLead): string {
  const name = lead.name || 'Lead';
  const project = lead.projectType ? ` — ${lead.projectType}` : '';
  return `${name}${project}`;
}

function buildBatchNudgeMessage(batchLeads: NudgeLead[]): string {
  if (batchLeads.length === 1) {
    const label = buildLeadLabel(batchLeads[0]);
    return `${label}. Did you win it?\nW = Won  L = Lost  0 = Skip`;
  }

  const lines = batchLeads.map((lead, i) => `${i + 1}. ${buildLeadLabel(lead)}`);
  return (
    `${batchLeads.length} jobs — won or lost?\n` +
    lines.join('\n') +
    '\nW + numbers = won, L + numbers = lost\n' +
    'e.g. W13 L2. Reply 0 to skip.'
  );
}

function buildBatchActionPayload(batchLeads: NudgeLead[]): Record<string, unknown> {
  return {
    interactionType: 'probable_wins_batch',
    options: batchLeads.map((lead, i) => ({
      index: i + 1,
      leadId: lead.id,
      label: buildLeadLabel(lead),
    })),
  };
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface ProbableWinsNudgeResult {
  nudged: number;
  skipped: number;
}

// ── Main runner ────────────────────────────────────────────────────────────────

/**
 * Finds two categories of unresolved leads and sends a batched won/lost nudge:
 *   1. Leads with a completed/confirmed appointment 7+ days ago (appointment path)
 *   2. Leads with status = 'estimate_sent' where updatedAt is 14+ days ago (estimate path)
 * Both lead types merge into the same per-client batch, share the same 7-day
 * cooldown check, and are capped at 5 leads per message.
 */
export async function nudgeProbableWins(): Promise<ProbableWinsNudgeResult> {
  const db = getDb();

  let nudged = 0;
  let skipped = 0;

  const now = new Date();
  const appointmentCutoff = new Date(now.getTime() - APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const estimateStaleCutoff = new Date(now.getTime() - ESTIMATE_STALE_DAYS * 24 * 60 * 60 * 1000);
  const nudgeCooldownCutoff = new Date(now.getTime() - NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  // ── Step 1a: Find qualifying appointments ────────────────────────────────

  // Find all appointments that are completed/confirmed and at least 7 days old.
  // We need the lead's clientId and status to filter further.
  const qualifyingAppointments = await db
    .select({
      leadId: appointments.leadId,
      clientId: appointments.clientId,
      appointmentDate: appointments.appointmentDate,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .where(
      and(
        inArray(appointments.status, ['completed', 'confirmed']),
        lte(appointments.appointmentDate, appointmentCutoff.toISOString().split('T')[0]),
        eq(clients.status, 'active'),
      )
    );

  // ── Step 1b: Find stale estimate_sent leads ──────────────────────────────

  // Find leads with status = 'estimate_sent' where updatedAt is 14+ days ago
  // and the lead's client is active, excluding already-resolved statuses.
  const staleEstimateLeads = await db
    .select({
      id: leads.id,
      clientId: leads.clientId,
      name: leads.name,
      projectType: leads.projectType,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(
      and(
        eq(leads.status, 'estimate_sent'),
        lt(leads.updatedAt, estimateStaleCutoff),
        eq(clients.status, 'active'),
      )
    );

  // ── Step 2: Collect unresolved appointment-based leads ───────────────────

  const uniqueLeadIds = [...new Set(qualifyingAppointments.map((a) => a.leadId))];

  // Fetch leads from appointments that are NOT yet resolved and belong to active clients
  const unresolvedAppointmentLeads = uniqueLeadIds.length > 0
    ? await db
        .select({
          id: leads.id,
          clientId: leads.clientId,
          name: leads.name,
          projectType: leads.projectType,
        })
        .from(leads)
        .where(
          and(
            inArray(leads.id, uniqueLeadIds),
            notInArray(leads.status, [...RESOLVED_STATUSES]),
          )
        )
    : [];

  // ── Step 2b: Merge both lead sources ────────────────────────────────────

  // Use a map to deduplicate by leadId before merging
  const mergedLeadMap = new Map<string, { id: string; clientId: string; name: string | null; projectType: string | null }>();

  for (const lead of unresolvedAppointmentLeads) {
    mergedLeadMap.set(lead.id, lead);
  }
  for (const lead of staleEstimateLeads) {
    if (!mergedLeadMap.has(lead.id)) {
      mergedLeadMap.set(lead.id, lead);
    }
  }

  const unresolvedLeads = [...mergedLeadMap.values()];

  if (unresolvedLeads.length === 0) {
    return { nudged: 0, skipped: 0 };
  }

  // ── Step 3: Check cooldown — skip clients that got a nudge recently ───────

  // Find all clients we'd nudge
  const targetClientIds = [...new Set(unresolvedLeads.map((l) => l.clientId))];

  // Find clients who already got a won_lost_nudge in the last 7 days
  const recentNudges = await db
    .select({ clientId: agencyMessages.clientId })
    .from(agencyMessages)
    .where(
      and(
        inArray(agencyMessages.clientId, targetClientIds),
        eq(agencyMessages.promptType, 'won_lost_nudge'),
        gte(agencyMessages.createdAt, nudgeCooldownCutoff),
      )
    );

  const recentlyNudgedClientIds = new Set(recentNudges.map((r) => r.clientId));

  // ── Step 4: Group leads by client, send batched nudges ─────────────────────

  // Group unresolved leads by clientId, deduped
  const leadsPerClient = new Map<string, NudgeLead[]>();
  const seen = new Set<string>();

  for (const lead of unresolvedLeads) {
    if (seen.has(lead.id)) {
      skipped++;
      continue;
    }
    seen.add(lead.id);

    if (recentlyNudgedClientIds.has(lead.clientId)) {
      skipped++;
      continue;
    }

    const existing = leadsPerClient.get(lead.clientId) ?? [];
    if (existing.length < 5) {
      // Cap at 5 leads per batch to keep the SMS readable
      existing.push({ id: lead.id, name: lead.name, projectType: lead.projectType });
      leadsPerClient.set(lead.clientId, existing);
    } else {
      skipped++; // Overflow leads roll to next week's nudge
    }
  }

  // Send one batched message per client
  for (const [clientId, batchLeads] of leadsPerClient) {
    try {
      // Ensure ref codes still exist for backward compat (old WON/LOST commands)
      for (const lead of batchLeads) {
        await ensureOutcomeRefCode(lead.id, clientId);
      }

      const message = buildBatchNudgeMessage(batchLeads);
      const payload = buildBatchActionPayload(batchLeads);

      const messageId = await sendActionPrompt({
        clientId,
        promptType: 'won_lost_nudge',
        message,
        actionPayload: payload,
        expiresInHours: 7 * 24,
      });

      if (messageId) {
        nudged += batchLeads.length;
      } else {
        skipped += batchLeads.length;
      }
    } catch (error) {
      logSanitizedConsoleError('[ProbableWinsNudge] Failed to send batch nudge:', error, {
        clientId,
        leadCount: batchLeads.length,
      });
      skipped += batchLeads.length;
    }
  }

  console.log(`[ProbableWinsNudge] Done. nudged=${nudged}, skipped=${skipped}`);

  return { nudged, skipped };
}
