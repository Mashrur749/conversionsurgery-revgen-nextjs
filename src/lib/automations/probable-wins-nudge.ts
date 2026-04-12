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
 * - At least one appointment for the lead must be completed or confirmed
 * - The most recent qualifying appointment must be 7+ days old
 * - No won_lost_nudge prompt sent to this client in the last 7 days
 *   (checked via agencyMessages with promptType = 'won_lost_nudge')
 * - Client must be active and have a phone number
 * - At most 1 nudge per lead per client per run (deduped by leadId)
 */

import { getDb } from '@/db';
import { leads, clients, appointments, agencyMessages } from '@/db/schema';
import { eq, and, notInArray, inArray, gte, lte, desc } from 'drizzle-orm';
import { sendActionPrompt } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { ensureOutcomeRefCode } from '@/lib/services/outcome-ref-codes';

// ── Constants ─────────────────────────────────────────────────────────────────

const APPOINTMENT_AGE_DAYS = 7;
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
 * Finds leads with a completed/confirmed appointment 14+ days ago where the
 * lead is still unresolved, and sends a won/lost nudge to the contractor.
 */
export async function nudgeProbableWins(): Promise<ProbableWinsNudgeResult> {
  const db = getDb();

  let nudged = 0;
  let skipped = 0;

  const now = new Date();
  const appointmentCutoff = new Date(now.getTime() - APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const nudgeCooldownCutoff = new Date(now.getTime() - NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  // ── Step 1: Find qualifying appointments ─────────────────────────────────

  // Find all appointments that are completed/confirmed and at least 14 days old.
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

  if (qualifyingAppointments.length === 0) {
    return { nudged: 0, skipped: 0 };
  }

  // ── Step 2: Collect unique leadIds to check lead status ──────────────────

  const uniqueLeadIds = [...new Set(qualifyingAppointments.map((a) => a.leadId))];

  // Fetch leads that are NOT yet resolved and belong to active clients
  const unresolvedLeads = await db
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
    );

  if (unresolvedLeads.length === 0) {
    return { nudged: 0, skipped: 0 };
  }

  // ── Step 3: Check cooldown — skip clients that got a nudge recently ───────

  // Find all clients we'd nudge
  const targetClientIds = [...new Set(unresolvedLeads.map((l) => l.clientId))];

  // Find clients who already got a won_lost_nudge in the last 14 days
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

  const appointmentByLead = new Map(
    qualifyingAppointments.map((a) => [a.leadId, a])
  );

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

    const appt = appointmentByLead.get(lead.id);
    if (!appt) {
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
