/**
 * Onboarding Priming Automation
 *
 * Sends an automated SMS to new contractors shortly after signup, asking them
 * to think of 5 dead quotes before the onboarding call.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendAlert (agency
 * channel), NOT the compliance gateway.
 *
 * Runs daily at 7am UTC via the cron orchestrator.
 *
 * Rules:
 * - Client must be active
 * - Client createdAt must be in the 24-48 hour window
 * - At most one priming SMS per client, ever (checked via audit_log action = 'onboarding_priming')
 */

import { getDb } from '@/db';
import { clients, auditLog } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const WINDOW_MIN_HOURS = 24; // 24 hours ago (lower bound — client is at least 1 day old)
const WINDOW_MAX_HOURS = 48; // 48 hours ago (upper bound — client is at most 2 days old)
const AUDIT_ACTION = 'onboarding_priming';

const PRIMING_MESSAGE =
  'Before our call \u2014 think of 5 people you quoted in the last 6 months that never got back to you. Just first names and what the project was. That is all I need.';

export interface OnboardingPrimingResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function runOnboardingPriming(): Promise<OnboardingPrimingResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MAX_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - WINDOW_MIN_HOURS * 60 * 60 * 1000);

  // Find active clients created in the 24-48 hour window
  const candidateClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        gte(clients.createdAt, windowStart),
        lte(clients.createdAt, windowEnd)
      )
    );

  if (candidateClients.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [] };
  }

  scanned = candidateClients.length;
  const candidateIds = candidateClients.map((c) => c.id);

  // Find clients that already received this priming SMS (audit_log dedup)
  const alreadySent = await db
    .select({ clientId: auditLog.clientId })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, candidateIds),
        eq(auditLog.action, AUDIT_ACTION)
      )
    );

  const alreadySentIds = new Set(alreadySent.map((row) => row.clientId));

  for (const client of candidateClients) {
    if (alreadySentIds.has(client.id)) {
      skipped++;
      continue;
    }

    try {
      await sendAlert({
        clientId: client.id,
        message: PRIMING_MESSAGE,
      });

      // Log to audit_log to prevent future repeats
      await db.insert(auditLog).values({
        clientId: client.id,
        action: AUDIT_ACTION,
        resourceType: 'client',
        metadata: {},
      });

      sent++;
      console.log(`[OnboardingPriming] Sent priming SMS to client ${client.businessName}`);
    } catch (error) {
      logSanitizedConsoleError('[OnboardingPriming] Failed to send priming SMS:', error, {
        clientId: client.id,
      });
      errors.push(`Client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(
    `[OnboardingPriming] Done. scanned=${scanned}, sent=${sent}, skipped=${skipped}, errors=${errors.length}`
  );
  return { scanned, sent, skipped, errors };
}
