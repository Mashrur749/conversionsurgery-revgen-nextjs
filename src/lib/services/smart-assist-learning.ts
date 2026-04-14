import { getDb } from '@/db';
import { scheduledMessages, auditLog } from '@/db/schema';
import { eq, and, gte, sql, isNotNull } from 'drizzle-orm';

/**
 * Detect and log Smart Assist corrections — cases where the contractor
 * edited the AI draft before sending.
 *
 * Called from sendSmartAssistDraftNow() when an edited draft is sent.
 */
export async function logSmartAssistCorrection(params: {
  scheduledMessageId: string;
  clientId: string;
  leadId: string;
  originalContent: string;
  editedContent: string;
}): Promise<void> {
  const db = getDb();

  await db.insert(auditLog).values({
    personId: null,
    clientId: params.clientId,
    action: 'smart_assist_correction',
    resourceType: 'scheduled_message',
    resourceId: params.scheduledMessageId,
    metadata: {
      leadId: params.leadId,
      originalContent: params.originalContent,
      editedContent: params.editedContent,
      originalLength: params.originalContent.length,
      editedLength: params.editedContent.length,
      lengthDelta: params.editedContent.length - params.originalContent.length,
    },
    createdAt: new Date(),
  });
}

/**
 * Get correction rate for a client over a time period.
 * Used by drift detection (Plan 4 Task 11) and operator dashboard.
 */
export async function getSmartAssistCorrectionRate(
  clientId: string,
  since: Date,
): Promise<{ total: number; corrected: number; rate: number }> {
  const db = getDb();

  // Count total resolved drafts (auto_sent + approved_sent)
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.clientId, clientId),
        eq(scheduledMessages.sequenceType, 'smart_assist'),
        gte(scheduledMessages.createdAt, since),
        // assistStatus is either 'auto_sent' or 'approved_sent'
        isNotNull(scheduledMessages.assistResolvedAt),
      )
    );

  // Count corrections (approved_sent where content differs from original)
  const [correctedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.clientId, clientId),
        eq(scheduledMessages.sequenceType, 'smart_assist'),
        gte(scheduledMessages.createdAt, since),
        eq(scheduledMessages.assistStatus, 'approved_sent'),
        isNotNull(scheduledMessages.assistOriginalContent),
        // Content was changed — compare current content to original
        sql`${scheduledMessages.content} != ${scheduledMessages.assistOriginalContent}`,
      )
    );

  const total = Number(totalResult?.count ?? 0);
  const corrected = Number(correctedResult?.count ?? 0);

  return {
    total,
    corrected,
    rate: total > 0 ? corrected / total : 0,
  };
}
