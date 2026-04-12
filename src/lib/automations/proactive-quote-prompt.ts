/**
 * Proactive Quote Prompt Automation
 *
 * Fires once per lead when a lead has been sitting in `new` or `contacted`
 * status for 3+ days without any estimate follow-up sequence being started.
 * Sends an SMS to the contractor (client.phone) via their Twilio number asking
 * them whether they sent a quote.
 *
 * This is a CONTRACTOR-facing notification sent through the compliance gateway
 * (contractor is the "homeowner" here — sendCompliantMessage is used because
 * the contractor's phone is the registered recipient for their own business
 * number).
 *
 * Runs daily at 10am UTC via the cron orchestrator.
 *
 * Rules:
 * - Lead status must be `new` or `contacted`
 * - Lead was created 3+ days ago
 * - No estimate follow-up sequence has been started for this lead
 *   (no scheduledMessages with sequenceType containing 'estimate')
 * - Lead has NOT been prompted before
 *   (no audit_log entry with action = 'quote_prompt_sent' + resourceId = leadId)
 * - Client must be active and have a phone + Twilio number
 * - One prompt per lead, ever (lifetime dedup via audit_log)
 */

import { getDb } from '@/db';
import { leads, clients, scheduledMessages, auditLog } from '@/db/schema';
import { eq, and, inArray, lte, or, like } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAD_AGE_DAYS = 3;
const AUDIT_ACTION = 'quote_prompt_sent';
const PROMPT_STATUSES = ['new', 'contacted'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProactiveQuotePromptResult {
  sent: number;
  skipped: number;
  errors: number;
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildPromptMessage(leadName: string | null): string {
  const nameDisplay = leadName ?? 'This lead';
  return (
    `${nameDisplay} has been waiting 3 days. Did you send a quote? ` +
    `Reply EST ${leadName ?? 'LEAD'} to start follow-up, or PASS to skip.`
  );
}

// ── Main runner ────────────────────────────────────────────────────────────────

/**
 * Finds leads in `new` or `contacted` status for 3+ days with no estimate
 * sequence started, then sends a one-time quote-prompt SMS to each contractor.
 */
export async function runProactiveQuotePrompt(): Promise<ProactiveQuotePromptResult> {
  const db = getDb();

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date();
  const ageCutoff = new Date(now.getTime() - LEAD_AGE_DAYS * 24 * 60 * 60 * 1000);

  // ── Step 1: Find candidate leads ─────────────────────────────────────────

  const candidateLeads = await db
    .select({
      leadId: leads.id,
      leadName: leads.name,
      clientId: leads.clientId,
      clientPhone: clients.phone,
      clientTwilioNumber: clients.twilioNumber,
      clientStatus: clients.status,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(
      and(
        or(
          eq(leads.status, 'new'),
          eq(leads.status, 'contacted')
        ),
        lte(leads.createdAt, ageCutoff),
        eq(clients.status, 'active')
      )
    )
    .limit(500);

  if (candidateLeads.length === 0) {
    console.log('[ProactiveQuotePrompt] No candidates found.');
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const leadIds = candidateLeads.map((r) => r.leadId);

  // ── Step 2: Exclude leads with an active or past estimate sequence ────────

  const estimateSequenceRows = await db
    .select({ leadId: scheduledMessages.leadId })
    .from(scheduledMessages)
    .where(
      and(
        inArray(scheduledMessages.leadId, leadIds),
        like(scheduledMessages.sequenceType, '%estimate%')
      )
    );

  const leadsWithEstimateSequence = new Set(estimateSequenceRows.map((r) => r.leadId));

  // ── Step 3: Exclude leads already prompted (audit_log dedup) ─────────────

  const alreadyPromptedRows = await db
    .select({ resourceId: auditLog.resourceId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, AUDIT_ACTION),
        inArray(auditLog.resourceId, leadIds)
      )
    );

  const alreadyPromptedLeadIds = new Set(
    alreadyPromptedRows
      .map((r) => r.resourceId)
      .filter((id): id is string => id !== null)
  );

  // ── Step 4: Send prompts ──────────────────────────────────────────────────

  for (const row of candidateLeads) {
    // Skip leads that already have an estimate sequence
    if (leadsWithEstimateSequence.has(row.leadId)) {
      skipped++;
      continue;
    }

    // Skip leads already prompted
    if (alreadyPromptedLeadIds.has(row.leadId)) {
      skipped++;
      continue;
    }

    // Skip clients without phone or Twilio number
    if (!row.clientPhone || !row.clientTwilioNumber) {
      skipped++;
      continue;
    }

    const normalizedTo = normalizePhoneNumber(row.clientPhone);
    const normalizedFrom = normalizePhoneNumber(row.clientTwilioNumber);

    try {
      const body = buildPromptMessage(row.leadName);

      await sendCompliantMessage({
        clientId: row.clientId,
        to: normalizedTo,
        from: normalizedFrom,
        body,
        messageClassification: 'proactive_outreach',
        messageCategory: 'transactional',
        consentBasis: { type: 'existing_customer' },
        leadId: row.leadId,
        queueOnQuietHours: true,
      });

      // Record in audit_log so this lead is never prompted again
      await db.insert(auditLog).values({
        action: AUDIT_ACTION,
        resourceType: 'lead',
        resourceId: row.leadId,
        clientId: row.clientId,
        metadata: { leadName: row.leadName ?? null },
      });

      sent++;
    } catch (err) {
      logSanitizedConsoleError('[ProactiveQuotePrompt] Failed for lead:', err, {
        leadId: row.leadId,
        clientId: row.clientId,
      });
      errors++;
    }
  }

  console.log(
    `[ProactiveQuotePrompt] Done. sent=${sent}, skipped=${skipped}, errors=${errors}`
  );

  return { sent, skipped, errors };
}
