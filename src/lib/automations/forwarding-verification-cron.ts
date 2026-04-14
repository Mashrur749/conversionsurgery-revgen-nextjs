/**
 * Forwarding Verification Cron (FMA 4.5)
 *
 * Runs daily for the first 7 days after a client is created.
 * Places a test call to verify call forwarding is configured correctly.
 *
 * Constraints:
 * - Max 1 attempt per client per day (dedup via audit_log)
 * - Never runs after 7 days post-creation
 * - Feature flag check per client (forwardingVerification)
 * - Business hours only (10am–4pm in client's local timezone)
 * - Never runs if status is 'passed' or 'skipped'
 */

import { getDb } from '@/db';
import { clients, auditLog } from '@/db/schema';
import { eq, and, gte, or, isNull, ne } from 'drizzle-orm';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';
import { initiateVerificationCall } from '@/lib/services/forwarding-verification';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

export async function runForwardingVerificationCron(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  const db = getDb();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  // Query clients in their first 7 days that haven't passed or been skipped
  const eligibleClients = await db
    .select({
      id: clients.id,
      timezone: clients.timezone,
      forwardingVerificationStatus: clients.forwardingVerificationStatus,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        gte(clients.createdAt, sevenDaysAgo),
        or(
          isNull(clients.forwardingVerificationStatus),
          and(
            ne(clients.forwardingVerificationStatus, 'passed'),
            ne(clients.forwardingVerificationStatus, 'skipped')
          )
        )
      )
    );

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const client of eligibleClients) {
    try {
      // Check feature flag
      const enabled = await resolveFeatureFlag(client.id, 'forwardingVerification');
      if (!enabled) {
        skipped++;
        continue;
      }

      // Check dedup: already attempted today?
      const existingAttempts = await db
        .select({ id: auditLog.id })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.clientId, client.id),
            eq(auditLog.action, 'forwarding_verification_attempt'),
            gte(auditLog.createdAt, todayStart)
          )
        )
        .limit(1);

      if (existingAttempts.length > 0) {
        skipped++;
        continue;
      }

      // Check business hours (10am–4pm) in client's local timezone
      const clientLocalHour = new Date().toLocaleString('en-US', {
        timeZone: client.timezone ?? 'America/New_York',
        hour: 'numeric',
        hour12: false,
      });
      const hour = parseInt(clientLocalHour, 10);
      if (hour < 10 || hour >= 16) {
        skipped++;
        continue;
      }

      // Place the verification call
      await initiateVerificationCall(client.id);
      processed++;
    } catch (error) {
      logSanitizedConsoleError(
        '[ForwardingVerificationCron] Error processing client',
        error,
        { clientId: client.id }
      );
      errors++;
    }
  }

  return { processed, skipped, errors };
}
