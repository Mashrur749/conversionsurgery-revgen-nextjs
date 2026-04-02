/**
 * Day 3 Check-in Automation
 *
 * Sends an automated SMS to new contractors at day 3, including real activity
 * data (leads captured, messages sent, missed calls handled) since signup.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendAlert (agency
 * channel), NOT the compliance gateway.
 *
 * Runs daily at 7am UTC via the cron orchestrator.
 *
 * Rules:
 * - Client must be active
 * - Client createdAt must be in the 3-day window (±6 hours, i.e. 66-78 hours ago)
 * - At most one check-in per client, ever (checked via audit_log action = 'day3_checkin')
 */

import { getDb } from '@/db';
import { clients, auditLog, leads, conversations } from '@/db/schema';
import { eq, and, gte, lte, count, inArray } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const WINDOW_MIN_HOURS = 66; // 3 days minus 6 hour tolerance
const WINDOW_MAX_HOURS = 78; // 3 days plus 6 hour tolerance
const AUDIT_ACTION = 'day3_checkin';

export interface Day3CheckinResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function runDay3Checkin(): Promise<Day3CheckinResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MAX_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - WINDOW_MIN_HOURS * 60 * 60 * 1000);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

  // Find active clients created in the day-3 window
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

  // Find clients that already received this check-in (audit_log dedup)
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

  // Fetch activity stats per client since signup
  const leadCounts = await db
    .select({
      clientId: leads.clientId,
      leadCount: count(leads.id),
    })
    .from(leads)
    .where(inArray(leads.clientId, candidateIds))
    .groupBy(leads.clientId);

  const leadCountMap = new Map(leadCounts.map((row) => [row.clientId, Number(row.leadCount)]));

  const messageCounts = await db
    .select({
      clientId: conversations.clientId,
      messageCount: count(conversations.id),
    })
    .from(conversations)
    .where(
      and(
        inArray(conversations.clientId, candidateIds),
        eq(conversations.direction, 'outbound')
      )
    )
    .groupBy(conversations.clientId);

  const messageCountMap = new Map(messageCounts.map((row) => [row.clientId, Number(row.messageCount)]));

  for (const client of candidateClients) {
    if (alreadySentIds.has(client.id)) {
      skipped++;
      continue;
    }

    const leadsCount = leadCountMap.get(client.id) ?? 0;
    const messagesCount = messageCountMap.get(client.id) ?? 0;

    try {
      await sendAlert({
        clientId: client.id,
        message: `Day 3 update — ${leadsCount} leads captured, ${messagesCount} conversations handled since you signed up. Everything is running. Check your dashboard: ${appUrl}/client`,
      });

      // Log to audit_log to prevent future repeats
      await db.insert(auditLog).values({
        clientId: client.id,
        action: AUDIT_ACTION,
        resourceType: 'client',
        metadata: { leadsCount, messagesCount },
      });

      sent++;
      console.log(`[Day3Checkin] Sent check-in to client ${client.businessName} (leads=${leadsCount}, messages=${messagesCount})`);
    } catch (error) {
      logSanitizedConsoleError('[Day3Checkin] Failed to send check-in:', error, {
        clientId: client.id,
      });
      errors.push(`Client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`[Day3Checkin] Done. scanned=${scanned}, sent=${sent}, skipped=${skipped}, errors=${errors.length}`);
  return { scanned, sent, skipped, errors };
}
