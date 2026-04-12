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

// ── Message builder ────────────────────────────────────────────────────────────

function buildNudgeMessage(leadName: string, projectType: string | null, refCode: string): string {
  const project = projectType ?? 'project';
  const nameDisplay = leadName || 'this lead';
  return (
    `Did you win ${nameDisplay}'s ${project}? ` +
    `Ref ${refCode}. Reply WON ${refCode} or LOST ${refCode} to your business number.`
  );
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

  // ── Step 4: Send nudges ───────────────────────────────────────────────────

  // Build a map of leadId → appointment info for quick lookups
  const appointmentByLead = new Map(
    qualifyingAppointments.map((a) => [a.leadId, a])
  );

  // Dedupe: one nudge per lead
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

    try {
      const refCode = await ensureOutcomeRefCode(lead.id, lead.clientId);
      const message = buildNudgeMessage(lead.name ?? '', lead.projectType ?? null, refCode);

      const messageId = await sendActionPrompt({
        clientId: lead.clientId,
        promptType: 'won_lost_nudge',
        message,
        actionPayload: { leadId: lead.id },
        expiresInHours: 7 * 24, // 7 days
      });

      if (messageId) {
        nudged++;
      } else {
        // sendActionPrompt returned null — quiet hours or no phone
        skipped++;
      }
    } catch (error) {
      logSanitizedConsoleError('[ProbableWinsNudge] Failed to send nudge:', error, {
        leadId: lead.id,
        clientId: lead.clientId,
      });
      skipped++;
    }
  }

  console.log(`[ProbableWinsNudge] Done. nudged=${nudged}, skipped=${skipped}`);

  return { nudged, skipped };
}
