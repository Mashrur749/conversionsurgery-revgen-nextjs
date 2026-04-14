/**
 * Pre-Guarantee Day 80 Operator Alert
 *
 * Fires once per client when they are 8–12 days from the 90-day guarantee
 * deadline (i.e. `guaranteeRecoveryEndsAt` is between 8 and 12 days from now)
 * AND the guarantee has not yet been fulfilled or refunded AND there is no
 * sufficient pipeline evidence (no attributed opportunities, no WON leads
 * with confirmed revenue).
 *
 * This alerts the OPERATOR (not the contractor) so they can intervene and
 * schedule a revenue-capture call before the refund window opens.
 *
 * Runs daily at midnight UTC via the cron orchestrator.
 *
 * Rules:
 * - `guaranteeRecoveryEndsAt` must fall within the 8–12 day forward window
 * - `guaranteeStatus` must NOT be 'fulfilled', 'recovery_passed', or 'refunded'
 *   (no legacy 'refunded' value exists; use 'recovery_failed_refund_review' proxy)
 * - Client must have zero attributed recovery opportunities AND no WON leads
 *   with confirmed revenue
 * - At most one alert per client, ever (dedup via audit_log action = 'guarantee_alert_day80')
 */

import { getDb } from '@/db';
import { clients, auditLog, leads, subscriptions } from '@/db/schema';
import { eq, and, gte, lte, inArray, gt, notInArray } from 'drizzle-orm';
import { alertOperator } from '@/lib/services/operator-alerts';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// 8–12 day window around the "Day 80" mark (guarantee ends at Day 90)
const WINDOW_MIN_DAYS = 8;
const WINDOW_MAX_DAYS = 12;

const AUDIT_ACTION = 'guarantee_alert_day80';

// Guarantee statuses that mean the guarantee is already resolved — skip these
const RESOLVED_STATUSES = [
  'fulfilled',
  'recovery_passed',
  'recovery_failed_refund_review',
  'proof_failed_refund_review',
] as const;

export interface GuaranteeAlertResult {
  scanned: number;
  alerted: number;
  skipped: number;
  errors: string[];
}

export async function runGuaranteeAlert(): Promise<GuaranteeAlertResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let alerted = 0;
  let skipped = 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000);

  // Find subscriptions whose recovery window ends in 8–12 days and is not yet resolved
  const candidateSubs = await db
    .select({
      clientId: subscriptions.clientId,
      guaranteeRecoveryEndsAt: subscriptions.guaranteeRecoveryEndsAt,
      guaranteeStatus: subscriptions.guaranteeStatus,
      guaranteeRecoveryAttributedOpportunities:
        subscriptions.guaranteeRecoveryAttributedOpportunities,
    })
    .from(subscriptions)
    .where(
      and(
        gte(subscriptions.guaranteeRecoveryEndsAt, windowStart),
        lte(subscriptions.guaranteeRecoveryEndsAt, windowEnd),
        notInArray(subscriptions.guaranteeStatus, [...RESOLVED_STATUSES])
      )
    );

  if (candidateSubs.length === 0) {
    return { scanned: 0, alerted: 0, skipped: 0, errors: [] };
  }

  scanned = candidateSubs.length;
  const candidateClientIds = candidateSubs.map((s) => s.clientId);

  // Dedup — skip clients that already received this alert
  const alreadyAlerted = await db
    .select({ clientId: auditLog.clientId })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, candidateClientIds),
        eq(auditLog.action, AUDIT_ACTION)
      )
    );

  const alreadyAlertedIds = new Set(alreadyAlerted.map((row) => row.clientId));

  // Find WON leads with confirmed revenue per client
  const wonLeads = await db
    .select({ clientId: leads.clientId, confirmedRevenue: leads.confirmedRevenue })
    .from(leads)
    .where(
      and(
        inArray(leads.clientId, candidateClientIds),
        eq(leads.status, 'won'),
        gt(leads.confirmedRevenue, 0)
      )
    );

  const wonLeadClientIds = new Set(wonLeads.map((l) => l.clientId));

  // Fetch client names for the alert messages
  const clientRows = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(inArray(clients.id, candidateClientIds));

  const clientNameMap = new Map(clientRows.map((c) => [c.id, c.businessName]));

  for (const sub of candidateSubs) {
    if (alreadyAlertedIds.has(sub.clientId)) {
      skipped++;
      continue;
    }

    // Skip if pipeline is already sufficient
    const hasAttributedOpportunities =
      (sub.guaranteeRecoveryAttributedOpportunities ?? 0) >= 1;
    const hasWonRevenue = wonLeadClientIds.has(sub.clientId);

    if (hasAttributedOpportunities || hasWonRevenue) {
      skipped++;
      continue;
    }

    const businessName = clientNameMap.get(sub.clientId) ?? sub.clientId;
    const daysRemaining = sub.guaranteeRecoveryEndsAt
      ? Math.round(
          (sub.guaranteeRecoveryEndsAt.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : WINDOW_MIN_DAYS;

    const subject = `Guarantee alert: ${businessName} — ${daysRemaining} days left`;
    const detail =
      `Client "${businessName}" has ${daysRemaining} days until their 90-day guarantee deadline. ` +
      `Pipeline: $0 confirmed. No attributed result yet. ` +
      `Schedule a revenue-capture call before the refund window opens.`;

    try {
      await alertOperator(subject, detail);

      // Write audit_log entry for dedup and operator cockpit surfacing
      await db.insert(auditLog).values({
        clientId: sub.clientId,
        action: AUDIT_ACTION,
        resourceType: 'subscription',
        metadata: {
          daysRemaining,
          guaranteeStatus: sub.guaranteeStatus,
          attributedOpportunities: sub.guaranteeRecoveryAttributedOpportunities ?? 0,
        },
      });

      alerted++;
      console.log(
        `[GuaranteeAlert] Alerted operator for client ${businessName} (daysRemaining=${daysRemaining})`
      );
    } catch (error) {
      logSanitizedConsoleError('[GuaranteeAlert] Failed to send alert:', error, {
        clientId: sub.clientId,
      });
      errors.push(
        `Client ${sub.clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  console.log(
    `[GuaranteeAlert] Done. scanned=${scanned}, alerted=${alerted}, skipped=${skipped}, errors=${errors.length}`
  );
  return { scanned, alerted, skipped, errors };
}
