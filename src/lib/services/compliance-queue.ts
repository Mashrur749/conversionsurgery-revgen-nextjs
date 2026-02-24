import { getDb } from '@/db';
import { complianceAuditLog } from '@/db/schema/compliance';
import { and, asc, eq, sql } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { sendSMS } from '@/lib/services/twilio';
import { ComplianceService } from '@/lib/compliance/compliance-service';

interface QueueRunResult {
  scanned: number;
  replayed: number;
  skipped: number;
  failed: number;
}

/**
 * Replays non-lead quiet-hours queued messages from compliance audit log.
 */
export async function processQueuedComplianceMessages(limit = 100): Promise<QueueRunResult> {
  const db = getDb();
  const result: QueueRunResult = { scanned: 0, replayed: 0, skipped: 0, failed: 0 };

  const queuedEvents = await db
    .select()
    .from(complianceAuditLog)
    .where(eq(complianceAuditLog.eventType, 'message_queued'))
    .orderBy(asc(complianceAuditLog.eventTimestamp))
    .limit(limit);

  result.scanned = queuedEvents.length;

  for (const event of queuedEvents) {
    const data = (event.eventData || {}) as Record<string, unknown>;

    // Lead-linked messages are already persisted to scheduled_messages.
    if (data.persistedToSchedule) {
      result.skipped++;
      continue;
    }

    const to = data.phoneNumber as string | undefined;
    const from = data.from as string | undefined;
    const body = data.body as string | undefined;
    const messageCategory = (data.messageCategory as 'marketing' | 'transactional') || 'transactional';
    const messageClassification = (data.messageClassification as 'inbound_reply' | 'proactive_outreach') || 'proactive_outreach';

    if (!event.clientId || !to || !from || !body) {
      result.skipped++;
      continue;
    }

    const [alreadyReplayed] = await db
      .select({ id: complianceAuditLog.id })
      .from(complianceAuditLog)
      .where(
        and(
          eq(complianceAuditLog.eventType, 'message_queue_replayed'),
          sql`${complianceAuditLog.eventData}->>'queueEventId' = ${event.id}`
        )
      )
      .limit(1);

    if (alreadyReplayed) {
      result.skipped++;
      continue;
    }

    try {
      const sendResult = await sendCompliantMessage({
        clientId: event.clientId,
        to,
        from,
        body,
        messageClassification,
        messageCategory,
        consentBasis: { type: 'existing_consent' },
        queueOnQuietHours: false,
        metadata: {
          source: 'queued_compliance_replay',
          queueEventId: event.id,
        },
      });

      if (
        sendResult.blocked &&
        event.leadId == null &&
        (sendResult.blockReason || '').toLowerCase().includes('consent')
      ) {
        // Internal non-lead reminders may not have consent records.
        await sendSMS(to, body, from);
      } else if (sendResult.blocked) {
        result.skipped++;
        continue;
      }

      await ComplianceService.logComplianceEvent(event.clientId, 'message_queue_replayed', {
        queueEventId: event.id,
        phoneNumber: to,
        from,
      });

      result.replayed++;
    } catch (error) {
      console.error('[ComplianceQueue] Replay failed', event.id, error);
      await ComplianceService.logComplianceEvent(event.clientId, 'message_queue_replay_failed', {
        queueEventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      result.failed++;
    }
  }

  return result;
}
