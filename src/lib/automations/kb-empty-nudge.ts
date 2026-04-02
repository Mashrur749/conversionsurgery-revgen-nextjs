/**
 * KB Empty Nudge Automation
 *
 * When a new client has been active for 48-72 hours but has fewer than 3 KB
 * entries, sends them an SMS asking them to fill in their business info.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendAlert (agency
 * channel), NOT the compliance gateway.
 *
 * Runs daily at 10am UTC via the cron orchestrator.
 *
 * Rules:
 * - Client must be active
 * - Client createdAt must be in the 48-72 hour window (one-time window)
 * - KB entry count must be < 3 (active entries only)
 * - At most one nudge per client, ever (checked via audit_log action = 'kb_empty_nudge')
 */

import { getDb } from '@/db';
import { clients, knowledgeBase, auditLog } from '@/db/schema';
import { eq, and, gte, lte, count, inArray } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const KB_ENTRY_THRESHOLD = 3;
const WINDOW_MIN_HOURS = 48;
const WINDOW_MAX_HOURS = 72;
const AUDIT_ACTION = 'kb_empty_nudge';

export interface KbEmptyNudgeResult {
  scanned: number;
  nudged: number;
  skipped: number;
  errors: string[];
}

export async function runKbEmptyNudge(): Promise<KbEmptyNudgeResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let nudged = 0;
  let skipped = 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MAX_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - WINDOW_MIN_HOURS * 60 * 60 * 1000);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

  // Find active clients created in the 48-72 hour window
  const candidateClients = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        gte(clients.createdAt, windowStart),
        lte(clients.createdAt, windowEnd)
      )
    );

  if (candidateClients.length === 0) {
    return { scanned: 0, nudged: 0, skipped: 0, errors: [] };
  }

  scanned = candidateClients.length;
  const candidateIds = candidateClients.map((c) => c.id);

  // Find clients that already received this nudge (audit_log dedup)
  const alreadyNudged = await db
    .select({ clientId: auditLog.clientId })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, candidateIds),
        eq(auditLog.action, AUDIT_ACTION)
      )
    );

  const alreadyNudgedIds = new Set(alreadyNudged.map((row) => row.clientId));

  // Count active KB entries per client
  const kbCounts = await db
    .select({
      clientId: knowledgeBase.clientId,
      entryCount: count(knowledgeBase.id),
    })
    .from(knowledgeBase)
    .where(
      and(
        inArray(knowledgeBase.clientId, candidateIds),
        eq(knowledgeBase.isActive, true)
      )
    )
    .groupBy(knowledgeBase.clientId);

  const kbCountMap = new Map(kbCounts.map((row) => [row.clientId, Number(row.entryCount)]));

  for (const client of candidateClients) {
    if (alreadyNudgedIds.has(client.id)) {
      skipped++;
      continue;
    }

    const entryCount = kbCountMap.get(client.id) ?? 0;
    if (entryCount >= KB_ENTRY_THRESHOLD) {
      skipped++;
      continue;
    }

    try {
      await sendAlert({
        clientId: client.id,
        message: `Your AI assistant needs your business info to work well. It takes 10 minutes: ${appUrl}/client/onboarding`,
      });

      // Log to audit_log to prevent future repeats
      await db.insert(auditLog).values({
        clientId: client.id,
        action: AUDIT_ACTION,
        resourceType: 'client',
        metadata: { entryCount, threshold: KB_ENTRY_THRESHOLD },
      });

      nudged++;
      console.log(`[KbEmptyNudge] Sent nudge to client ${client.businessName} (${entryCount} KB entries)`);
    } catch (error) {
      logSanitizedConsoleError('[KbEmptyNudge] Failed to send nudge:', error, {
        clientId: client.id,
      });
      errors.push(`Client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`[KbEmptyNudge] Done. scanned=${scanned}, nudged=${nudged}, skipped=${skipped}, errors=${errors.length}`);
  return { scanned, nudged, skipped, errors };
}
