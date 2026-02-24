import { getDb, clients, conversations, dailyStats, leads, scheduledMessages } from '@/db';
import { and, eq, lte, sql } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { sendSMS } from '@/lib/services/twilio';
import type { AiAssistCategory } from '@/lib/services/ai-send-policy';
import { parseSmartAssistCommand } from '@/lib/services/smart-assist-command-parser';
import {
  resolveSmartAssistTransition,
  SMART_ASSIST_STATUS,
  SMART_ASSIST_SEQUENCE_TYPE,
  type SmartAssistTransitionAction,
} from '@/lib/services/smart-assist-state';

const REFERENCE_CODE_LENGTH = 8;

type SmartAssistMetric =
  | 'pending'
  | 'auto_sent'
  | 'approved_sent'
  | 'cancelled';

interface SmartAssistQueueInput {
  clientId: string;
  leadId: string;
  leadPhone: string;
  leadName?: string | null;
  ownerPhone: string | null;
  fromTwilioNumber: string;
  content: string;
  category: AiAssistCategory;
  delayMinutes: number;
  requiresManualApproval: boolean;
}

interface SmartAssistSendResult {
  success: boolean;
  status: 'auto_sent' | 'approved_sent' | 'cancelled' | null;
  reason:
    | 'sent'
    | 'blocked'
    | 'manual_required'
    | 'not_pending'
    | 'not_found'
    | 'claim_conflict'
    | 'send_failed';
}

interface SmartAssistCommandResult {
  handled: boolean;
  action?:
    | 'smart_assist_approved'
    | 'smart_assist_edited'
    | 'smart_assist_cancelled'
    | 'smart_assist_missing_reference'
    | 'smart_assist_send_failed';
}

function buildReferenceCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, REFERENCE_CODE_LENGTH).toUpperCase();
}

function truncateMessage(message: string, max = 120): string {
  if (message.length <= max) {
    return message;
  }
  return `${message.slice(0, max - 3)}...`;
}

function buildOwnerPrompt(input: {
  leadName?: string | null;
  leadPhone: string;
  referenceCode: string;
  preview: string;
  delayMinutes: number;
  requiresManualApproval: boolean;
}): string {
  const leadLabel = input.leadName?.trim().length
    ? input.leadName.trim()
    : input.leadPhone;
  const autoSendLine = input.requiresManualApproval
    ? 'Manual-only category: this draft will NOT auto-send.'
    : `Auto-send in ${input.delayMinutes} min if untouched.`;

  return [
    `AI draft for ${leadLabel}:`,
    `"${input.preview}"`,
    `Ref ${input.referenceCode}`,
    autoSendLine,
    `SEND ${input.referenceCode} = approve now`,
    `EDIT ${input.referenceCode}: <message> = edit + send`,
    `CANCEL ${input.referenceCode} = cancel`,
  ].join('\n');
}

async function incrementSmartAssistMetric(
  clientId: string,
  metric: SmartAssistMetric,
  includeMessageSent = false
): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const insertValues = {
    pending: { smartAssistPending: 1 },
    auto_sent: { smartAssistAutoSent: 1 },
    approved_sent: { smartAssistApprovedSent: 1 },
    cancelled: { smartAssistCancelled: 1 },
  }[metric];

  const updateValues = {
    pending: { smartAssistPending: sql`${dailyStats.smartAssistPending} + 1` },
    auto_sent: { smartAssistAutoSent: sql`${dailyStats.smartAssistAutoSent} + 1` },
    approved_sent: { smartAssistApprovedSent: sql`${dailyStats.smartAssistApprovedSent} + 1` },
    cancelled: { smartAssistCancelled: sql`${dailyStats.smartAssistCancelled} + 1` },
  }[metric];

  const messageInsert = includeMessageSent ? { messagesSent: 1 } : {};
  const messageUpdate = includeMessageSent
    ? { messagesSent: sql`${dailyStats.messagesSent} + 1` }
    : {};

  await db
    .insert(dailyStats)
    .values({
      clientId,
      date: today,
      ...insertValues,
      ...messageInsert,
    })
    .onConflictDoUpdate({
      target: [dailyStats.clientId, dailyStats.date],
      set: {
        ...updateValues,
        ...messageUpdate,
      },
    });
}

export async function queueSmartAssistDraft(
  input: SmartAssistQueueInput
): Promise<{ scheduledMessageId: string; referenceCode: string; sendAt: Date }> {
  const db = getDb();
  const now = new Date();
  const sendAt = new Date(now.getTime() + input.delayMinutes * 60 * 1000);
  const referenceCode = buildReferenceCode();

  const [scheduled] = await db
    .insert(scheduledMessages)
    .values({
      clientId: input.clientId,
      leadId: input.leadId,
      sequenceType: SMART_ASSIST_SEQUENCE_TYPE,
      sequenceStep: 1,
      content: input.content,
      sendAt,
      assistStatus: SMART_ASSIST_STATUS.PENDING_APPROVAL,
      assistCategory: input.category,
      assistRequiresManual: input.requiresManualApproval,
      assistOriginalContent: input.content,
      assistReferenceCode: referenceCode,
    })
    .returning({ id: scheduledMessages.id });

  await incrementSmartAssistMetric(input.clientId, 'pending');

  if (input.ownerPhone) {
    const prompt = buildOwnerPrompt({
      leadName: input.leadName,
      leadPhone: input.leadPhone,
      referenceCode,
      preview: truncateMessage(input.content),
      delayMinutes: input.delayMinutes,
      requiresManualApproval: input.requiresManualApproval,
    });

    try {
      await sendSMS(input.ownerPhone, prompt, input.fromTwilioNumber);
      await db
        .update(scheduledMessages)
        .set({ assistNotifiedAt: now })
        .where(eq(scheduledMessages.id, scheduled.id));
    } catch (error) {
      console.error('[SmartAssist] Failed to send owner prompt:', error);
    }
  }

  return {
    scheduledMessageId: scheduled.id,
    referenceCode,
    sendAt,
  };
}

export async function sendSmartAssistDraftNow(params: {
  scheduledMessageId: string;
  action: SmartAssistTransitionAction;
  editedContent?: string;
}): Promise<SmartAssistSendResult> {
  const db = getDb();
  const [row] = await db
    .select({
      message: scheduledMessages,
      lead: leads,
      client: clients,
    })
    .from(scheduledMessages)
    .innerJoin(leads, eq(scheduledMessages.leadId, leads.id))
    .innerJoin(clients, eq(scheduledMessages.clientId, clients.id))
    .where(eq(scheduledMessages.id, params.scheduledMessageId))
    .limit(1);

  if (!row) {
    return { success: false, status: null, reason: 'not_found' };
  }

  const { message, lead, client } = row;
  if (!client.twilioNumber) {
    return { success: false, status: null, reason: 'send_failed' };
  }

  if (message.assistStatus !== SMART_ASSIST_STATUS.PENDING_APPROVAL || message.sent || message.cancelled) {
    return { success: false, status: null, reason: 'not_pending' };
  }

  if (message.assistRequiresManual && params.action === 'auto_send') {
    return { success: false, status: null, reason: 'manual_required' };
  }

  const targetStatus = resolveSmartAssistTransition(SMART_ASSIST_STATUS.PENDING_APPROVAL, params.action);
  if (!targetStatus) {
    return { success: false, status: null, reason: 'not_pending' };
  }

  if (
    targetStatus !== SMART_ASSIST_STATUS.AUTO_SENT &&
    targetStatus !== SMART_ASSIST_STATUS.APPROVED_SENT
  ) {
    return { success: false, status: null, reason: 'not_pending' };
  }

  const finalContent = params.editedContent?.trim().length
    ? params.editedContent.trim()
    : message.content;

  const [claimed] = await db
    .update(scheduledMessages)
    .set({
      sent: true,
      sentAt: new Date(),
    })
    .where(and(
      eq(scheduledMessages.id, message.id),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false),
      eq(scheduledMessages.assistStatus, SMART_ASSIST_STATUS.PENDING_APPROVAL)
    ))
    .returning({ id: scheduledMessages.id });

  if (!claimed) {
    return { success: false, status: null, reason: 'claim_conflict' };
  }

  try {
    const sendResult = await sendCompliantMessage({
      clientId: client.id,
      to: lead.phone,
      from: client.twilioNumber,
      body: finalContent,
      messageClassification: 'inbound_reply',
      messageCategory: 'marketing',
      consentBasis: { type: 'existing_consent' },
      leadId: lead.id,
      queueOnQuietHours: false,
      metadata: {
        source: params.action === 'auto_send' ? 'smart_assist_auto_send' : 'smart_assist_approved_send',
        scheduledMessageId: message.id,
        assistCategory: message.assistCategory,
      },
    });

    if (sendResult.blocked) {
      await db
        .update(scheduledMessages)
        .set({
          sent: false,
          sentAt: null,
          cancelled: true,
          cancelledAt: new Date(),
          cancelledReason: `Compliance blocked: ${sendResult.blockReason || 'Unknown'}`,
          assistStatus: SMART_ASSIST_STATUS.CANCELLED,
          assistResolvedAt: new Date(),
          assistResolutionSource: 'compliance_blocked',
        })
        .where(eq(scheduledMessages.id, message.id));

      await incrementSmartAssistMetric(client.id, 'cancelled');
      return { success: false, status: 'cancelled', reason: 'blocked' };
    }

    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'ai_response',
      content: finalContent,
      twilioSid: sendResult.messageSid || undefined,
      aiConfidence: null,
    });

    await db
      .update(scheduledMessages)
      .set({
        content: finalContent,
        assistStatus: targetStatus,
        assistResolvedAt: new Date(),
        assistResolutionSource: params.action === 'auto_send' ? 'auto_send' : 'approved_send',
      })
      .where(eq(scheduledMessages.id, message.id));

    await incrementSmartAssistMetric(
      client.id,
      targetStatus === 'auto_sent' ? 'auto_sent' : 'approved_sent',
      true
    );

    return { success: true, status: targetStatus, reason: 'sent' };
  } catch (error) {
    console.error('[SmartAssist] Failed to send draft:', error);
    await db
      .update(scheduledMessages)
      .set({
        sent: false,
        sentAt: null,
      })
      .where(eq(scheduledMessages.id, message.id));

    return { success: false, status: null, reason: 'send_failed' };
  }
}

export async function cancelSmartAssistDraft(params: {
  scheduledMessageId: string;
  reason: string;
  source: string;
}): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({
      id: scheduledMessages.id,
      clientId: scheduledMessages.clientId,
      assistStatus: scheduledMessages.assistStatus,
      sent: scheduledMessages.sent,
      cancelled: scheduledMessages.cancelled,
    })
    .from(scheduledMessages)
    .where(eq(scheduledMessages.id, params.scheduledMessageId))
    .limit(1);

  if (!row || row.assistStatus !== SMART_ASSIST_STATUS.PENDING_APPROVAL || row.sent || row.cancelled) {
    return false;
  }

  const [updated] = await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: params.reason,
      assistStatus: SMART_ASSIST_STATUS.CANCELLED,
      assistResolvedAt: new Date(),
      assistResolutionSource: params.source,
    })
    .where(and(
      eq(scheduledMessages.id, row.id),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false),
      eq(scheduledMessages.assistStatus, SMART_ASSIST_STATUS.PENDING_APPROVAL)
    ))
    .returning({ id: scheduledMessages.id });

  if (!updated) {
    return false;
  }

  await incrementSmartAssistMetric(row.clientId, 'cancelled');
  return true;
}

export async function handleSmartAssistOwnerCommand(params: {
  clientId: string;
  fromPhone: string;
  fromTwilioNumber: string;
  messageBody: string;
}): Promise<SmartAssistCommandResult> {
  const parsed = parseSmartAssistCommand(params.messageBody);
  if (!parsed.matched) {
    return { handled: false };
  }

  const db = getDb();
  const [pending] = await db
    .select({
      id: scheduledMessages.id,
      leadId: scheduledMessages.leadId,
      assistStatus: scheduledMessages.assistStatus,
      sent: scheduledMessages.sent,
      cancelled: scheduledMessages.cancelled,
    })
    .from(scheduledMessages)
    .where(and(
      eq(scheduledMessages.clientId, params.clientId),
      eq(scheduledMessages.assistReferenceCode, parsed.referenceCode),
      eq(scheduledMessages.assistStatus, SMART_ASSIST_STATUS.PENDING_APPROVAL),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ))
    .limit(1);

  if (!pending) {
    await sendSMS(
      params.fromPhone,
      `No pending draft found for ref ${parsed.referenceCode}.`,
      params.fromTwilioNumber
    );
    return { handled: true, action: 'smart_assist_missing_reference' };
  }

  if (parsed.action === 'cancel') {
    const cancelled = await cancelSmartAssistDraft({
      scheduledMessageId: pending.id,
      reason: 'Cancelled by owner command',
      source: 'owner_cancel',
    });

    if (cancelled) {
      await sendSMS(
        params.fromPhone,
        `Cancelled draft ${parsed.referenceCode}.`,
        params.fromTwilioNumber
      );
      return { handled: true, action: 'smart_assist_cancelled' };
    }

    await sendSMS(
      params.fromPhone,
      `Draft ${parsed.referenceCode} was already processed.`,
      params.fromTwilioNumber
    );
    return { handled: true, action: 'smart_assist_send_failed' };
  }

  const sendResult = await sendSmartAssistDraftNow({
    scheduledMessageId: pending.id,
    action: 'approve_send',
    editedContent: parsed.action === 'edit' ? parsed.editedContent : undefined,
  });

  if (sendResult.success) {
    await sendSMS(
      params.fromPhone,
      parsed.action === 'edit'
        ? `Sent edited draft ${parsed.referenceCode}.`
        : `Sent draft ${parsed.referenceCode}.`,
      params.fromTwilioNumber
    );
    return {
      handled: true,
      action: parsed.action === 'edit' ? 'smart_assist_edited' : 'smart_assist_approved',
    };
  }

  await sendSMS(
    params.fromPhone,
    `Unable to send draft ${parsed.referenceCode}. It may already be resolved.`,
    params.fromTwilioNumber
  );
  return { handled: true, action: 'smart_assist_send_failed' };
}

export async function processDueSmartAssistDrafts(limit = 25): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const db = getDb();
  const due = await db
    .select({ id: scheduledMessages.id })
    .from(scheduledMessages)
    .where(and(
      eq(scheduledMessages.sequenceType, SMART_ASSIST_SEQUENCE_TYPE),
      eq(scheduledMessages.assistStatus, SMART_ASSIST_STATUS.PENDING_APPROVAL),
      eq(scheduledMessages.assistRequiresManual, false),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false),
      lte(scheduledMessages.sendAt, new Date())
    ))
    .limit(limit);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of due) {
    const result = await sendSmartAssistDraftNow({
      scheduledMessageId: row.id,
      action: 'auto_send',
    });

    if (result.success) {
      sent++;
      continue;
    }

    if (result.reason === 'manual_required' || result.reason === 'not_pending' || result.reason === 'claim_conflict') {
      skipped++;
      continue;
    }

    failed++;
  }

  return {
    processed: due.length,
    sent,
    skipped,
    failed,
  };
}
