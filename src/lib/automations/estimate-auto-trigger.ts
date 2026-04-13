import { getDb } from '@/db';
import { leads, scheduledMessages, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';

// ─── Signal detection ────────────────────────────────────────────────────────

/**
 * Patterns that indicate an estimate/quote has already been sent and the
 * homeowner is in the decision phase.
 *
 * Group 1: "waiting on/for [document]"
 * Group 2: "[received/got] [document]"
 * Group 3: "comparing [documents]"
 * Group 4: "[someone] sent [us] a [document]"
 * Group 5: "thinking it over" / "need time to decide"
 * Group 6: "reviewing [document]"
 * Group 7: "discussing with [family]"
 *
 * Intentionally NOT matched:
 *   - "how much does X cost?" (pricing inquiry)
 *   - "please send me a quote" (request, not confirmation of receipt)
 *   - "can I get a price?" (request)
 *   - "do you do free estimates?" (question)
 */
const SIGNAL_PATTERNS: RegExp[] = [
  // waiting on/for/to hear back on a document
  /waiting\s+(?:on|for|to\s+hear\s+back\s+(?:on|about))\s+(?:the\s+|your\s+|a\s+)?(?:quote|estimate|bid|price|proposal)/i,
  // waiting ... quote (relaxed middle distance: e.g. "waiting to hear back on that quote")
  /waiting\b.{0,30}\b(?:quote|estimate|bid|price|proposal)\b/i,

  // received/got a document
  /(?:received|got)\s+(?:the\s+|your\s+|a\s+)?(?:quote|estimate|bid|price|proposal)/i,

  // comparing multiple documents
  /comparing\s+(?:a\s+few\s+|some\s+|multiple\s+|several\s+)?(?:quotes|estimates|bids|prices)/i,

  // someone sent us a document (past tense — already received)
  /(?:you\s+)?sent\s+(?:us\s+|me\s+)?(?:a|the)\s+(?:quote|estimate|bid|price|proposal)/i,

  // thinking it over / need time to decide (decision-phase phrases)
  /thinking\s+it\s+over/i,
  /need\s+(?:some\s+|more\s+)?time\s+to\s+decide/i,

  // reviewing a document
  /reviewing\s+(?:the\s+|your\s+|a\s+)?(?:estimate|proposal|quote|bid|price)/i,

  // discussing with spouse/partner (classic post-estimate objection)
  /discussing\s+with\s+(?:my\s+)?(?:wife|husband|partner|spouse)/i,
];

/**
 * Returns true if the inbound message implies an estimate/quote was already
 * sent and the homeowner is in the consideration phase — i.e., the estimate
 * follow-up sequence should be started automatically.
 */
export function detectEstimateSentSignal(message: string): boolean {
  if (!message.trim()) return false;
  return SIGNAL_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── Auto-trigger ─────────────────────────────────────────────────────────────

export interface AutoTriggerResult {
  triggered: boolean;
  reason?: string;
}

/**
 * Checks the inbound message for estimate-sent signals and, when found,
 * auto-starts the 4-touch estimate follow-up sequence if one is not already
 * active and the lead is not already in estimate_sent status.
 *
 * Safe to call fire-and-forget — all errors are logged and swallowed.
 */
export async function maybeAutoTriggerEstimateFollowup(
  leadId: string,
  clientId: string,
  inboundMessage: string
): Promise<AutoTriggerResult> {
  // 1. Check for signal
  if (!detectEstimateSentSignal(inboundMessage)) {
    return { triggered: false, reason: 'no_signal' };
  }

  const db = getDb();

  // 2. Dedup: active estimate sequence already scheduled?
  const existingSequence = await db
    .select({ id: scheduledMessages.id })
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.leadId, leadId),
        eq(scheduledMessages.sequenceType, 'estimate_followup'),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      )
    )
    .limit(1);

  if (existingSequence.length > 0) {
    return { triggered: false, reason: 'sequence_already_active' };
  }

  // 3. Status check: lead already in estimate_sent?
  const [lead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (lead?.status === 'estimate_sent') {
    return { triggered: false, reason: 'already_estimate_sent_status' };
  }

  // 4. Start the follow-up sequence
  const result = await startEstimateFollowup({ leadId, clientId });

  if (!result.success) {
    return { triggered: false, reason: result.reason ?? 'start_failed' };
  }

  // 5. Audit log
  await db.insert(auditLog).values({
    clientId,
    action: 'estimate_auto_triggered',
    resourceType: 'lead',
    resourceId: leadId,
    metadata: {
      trigger: 'conversation_signal',
      source: 'auto_detected',
      scheduledCount: result.scheduledCount,
    },
  });

  console.log('[AutoTrigger] Estimate follow-up auto-started', { leadId, clientId });

  return { triggered: true };
}
