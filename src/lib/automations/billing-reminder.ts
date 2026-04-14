/**
 * Day 25 Billing Reminder Automation
 *
 * Sends an automated SMS to contractors 5 days before their free trial ends,
 * giving them advance notice of the billing start date.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendAlert (agency
 * channel), NOT the compliance gateway.
 *
 * Runs daily at midnight UTC via the cron orchestrator.
 *
 * Rules:
 * - Subscription must be in 'trialing' status
 * - trialEnd must be 4–6 days from now (±1 day tolerance window around day 25)
 * - At most one reminder per client, ever (checked via audit_log action = 'billing_reminder_day25')
 * - Respects the 'billingReminder' feature flag via resolveFeatureFlag()
 */

import { getDb } from '@/db';
import { clients, auditLog, subscriptions } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';

// 4–6 days from now (in hours), ±1 day window centred on "5 days before trial ends"
const WINDOW_MIN_HOURS = 96;  // 4 days
const WINDOW_MAX_HOURS = 144; // 6 days
const AUDIT_ACTION = 'billing_reminder_day25';

export interface BillingReminderResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: string[];
}

/** Format a Date as "Month D, YYYY" (e.g. "April 20, 2026"). */
function formatBillingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export async function runBillingReminder(): Promise<BillingReminderResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  const now = new Date();
  // trialEnd must fall within [now + 4d, now + 6d]
  const windowStart = new Date(now.getTime() + WINDOW_MIN_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_HOURS * 60 * 60 * 1000);

  // Find trialing subscriptions whose trial ends in the 4–6 day window,
  // joined to the client for status and business name.
  const candidates = await db
    .select({
      clientId: subscriptions.clientId,
      trialEnd: subscriptions.trialEnd,
      businessName: clients.businessName,
      clientStatus: clients.status,
    })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .where(
      and(
        eq(subscriptions.status, 'trialing'),
        eq(clients.status, 'active'),
        gte(subscriptions.trialEnd, windowStart),
        lte(subscriptions.trialEnd, windowEnd)
      )
    );

  if (candidates.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [] };
  }

  scanned = candidates.length;
  const candidateClientIds = candidates.map((c) => c.clientId);

  // Dedup: find clients that already received this reminder
  const alreadySent = await db
    .select({ clientId: auditLog.clientId })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, candidateClientIds),
        eq(auditLog.action, AUDIT_ACTION)
      )
    );

  const alreadySentIds = new Set(alreadySent.map((row) => row.clientId));

  for (const candidate of candidates) {
    // Skip if already sent
    if (alreadySentIds.has(candidate.clientId)) {
      skipped++;
      continue;
    }

    // Feature flag check — per client
    const flagEnabled = await resolveFeatureFlag(candidate.clientId, 'billingReminder');
    if (!flagEnabled) {
      skipped++;
      continue;
    }

    // Billing starts the day after trialEnd
    const billingStartDate = new Date(candidate.trialEnd!.getTime() + 24 * 60 * 60 * 1000);
    const billingDateStr = formatBillingDate(billingStartDate);

    const message =
      `Your free month ends in 5 days. Billing starts ${billingDateStr} at $1,000/month. Questions? Reply to this message.`;

    try {
      await sendAlert({
        clientId: candidate.clientId,
        message,
      });

      // Dedup record — one per client ever
      await db.insert(auditLog).values({
        clientId: candidate.clientId,
        action: AUDIT_ACTION,
        resourceType: 'client',
        metadata: { billingStartDate: billingStartDate.toISOString() },
      });

      sent++;
      console.log(
        `[BillingReminder] Sent reminder to client ${candidate.businessName} (billingStart=${billingDateStr})`
      );
    } catch (error) {
      logSanitizedConsoleError('[BillingReminder] Failed to send reminder:', error, {
        clientId: candidate.clientId,
      });
      errors.push(
        `Client ${candidate.clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  console.log(
    `[BillingReminder] Done. scanned=${scanned}, sent=${sent}, skipped=${skipped}, errors=${errors.length}`
  );
  return { scanned, sent, skipped, errors };
}
