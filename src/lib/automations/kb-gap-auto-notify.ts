/**
 * KB Gap Auto-Notify Automation
 *
 * When the AI encounters a question it can't answer (knowledge gap), this
 * automation automatically sends the contractor an SMS asking them to fill
 * the gap in their knowledge base.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendAlert (agency
 * channel), NOT the compliance gateway.
 *
 * Runs daily at 10am UTC via the cron orchestrator.
 *
 * Rules:
 * - Only notifies for gaps in 'new' or 'in_progress' status
 * - Skips gaps where a contractor notification has already been sent
 *   (checked via audit_log action = 'kb_gap_contractor_notify' + gapId as resourceId)
 * - Max 2 gap notifications per client per day to avoid spamming
 * - Client must be active
 */

import { getDb } from '@/db';
import { clients, knowledgeGaps, auditLog } from '@/db/schema';
import { eq, and, inArray, gte, count } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const AUDIT_ACTION = 'kb_gap_contractor_notify';
const MAX_NOTIFICATIONS_PER_CLIENT_PER_DAY = 2;
const OPEN_STATUSES = ['new', 'in_progress'] as const;

export interface KbGapAutoNotifyResult {
  scanned: number;
  notified: number;
  skipped: number;
  errors: string[];
}

export async function runKbGapAutoNotify(): Promise<KbGapAutoNotifyResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let notified = 0;
  let skipped = 0;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

  // Find all open gaps for active clients, ordered by priority desc
  const openGaps = await db
    .select({
      id: knowledgeGaps.id,
      clientId: knowledgeGaps.clientId,
      question: knowledgeGaps.question,
      category: knowledgeGaps.category,
      priorityScore: knowledgeGaps.priorityScore,
      clientBusinessName: clients.businessName,
      clientStatus: clients.status,
    })
    .from(knowledgeGaps)
    .innerJoin(clients, eq(clients.id, knowledgeGaps.clientId))
    .where(
      and(
        inArray(knowledgeGaps.status, [...OPEN_STATUSES]),
        eq(clients.status, 'active')
      )
    );

  if (openGaps.length === 0) {
    return { scanned: 0, notified: 0, skipped: 0, errors: [] };
  }

  scanned = openGaps.length;

  // Find gaps already notified (ever) — deduplicate by resourceId = gap id
  const gapIds = openGaps.map((g) => g.id);

  const alreadyNotifiedLogs = await db
    .select({ resourceId: auditLog.resourceId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, AUDIT_ACTION),
        // resourceId is uuid type so filter via inArray
        inArray(auditLog.resourceId, gapIds)
      )
    );

  const alreadyNotifiedGapIds = new Set(
    alreadyNotifiedLogs.map((row) => row.resourceId).filter((id): id is string => id !== null)
  );

  // Count today's notifications per client (for daily cap)
  const clientIds = [...new Set(openGaps.map((g) => g.clientId))];

  const todayNotifyCounts = await db
    .select({
      clientId: auditLog.clientId,
      todayCount: count(auditLog.id),
    })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, clientIds),
        eq(auditLog.action, AUDIT_ACTION),
        gte(auditLog.createdAt, todayStart)
      )
    )
    .groupBy(auditLog.clientId);

  const todayCountMap = new Map(
    todayNotifyCounts.map((row) => [row.clientId, Number(row.todayCount)])
  );

  // Sort gaps by priorityScore desc so highest-priority get notified first
  const sortedGaps = [...openGaps].sort((a, b) => b.priorityScore - a.priorityScore);

  for (const gap of sortedGaps) {
    // Skip if already notified
    if (alreadyNotifiedGapIds.has(gap.id)) {
      skipped++;
      continue;
    }

    // Check daily cap per client
    const todayCount = todayCountMap.get(gap.clientId) ?? 0;
    if (todayCount >= MAX_NOTIFICATIONS_PER_CLIENT_PER_DAY) {
      skipped++;
      continue;
    }

    const topic = gap.category
      ? `${gap.category}: ${gap.question.slice(0, 80)}`
      : gap.question.slice(0, 100);

    try {
      await sendAlert({
        clientId: gap.clientId,
        message: `A customer asked about ${topic} and the AI didn't have an answer. Add it here: ${appUrl}/client/knowledge`,
      });

      // Log to audit_log to prevent repeats for this gap
      await db.insert(auditLog).values({
        clientId: gap.clientId,
        action: AUDIT_ACTION,
        resourceType: 'knowledge_gap',
        resourceId: gap.id,
        metadata: { question: gap.question.slice(0, 200), category: gap.category },
      });

      // Update the daily count map in memory
      todayCountMap.set(gap.clientId, (todayCountMap.get(gap.clientId) ?? 0) + 1);

      notified++;
      console.log(`[KbGapAutoNotify] Notified client ${gap.clientBusinessName} about gap: ${gap.question.slice(0, 60)}`);
    } catch (error) {
      logSanitizedConsoleError('[KbGapAutoNotify] Failed to send notification:', error, {
        clientId: gap.clientId,
        gapId: gap.id,
      });
      errors.push(`Gap ${gap.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`[KbGapAutoNotify] Done. scanned=${scanned}, notified=${notified}, skipped=${skipped}, errors=${errors.length}`);
  return { scanned, notified, skipped, errors };
}
