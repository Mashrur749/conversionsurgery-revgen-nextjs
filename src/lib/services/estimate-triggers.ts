import { getDb } from '@/db';
import { leads, scheduledMessages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';

export type EstimateTriggerSource =
  | 'dashboard_api'
  | 'sms_keyword'
  | 'prompt_quick_reply'
  | 'fallback_nudge'
  | 'manual';

interface TriggerEstimateFollowupInput {
  clientId: string;
  leadId: string;
  source: EstimateTriggerSource;
  force?: boolean;
}

export interface TriggerEstimateFollowupResult {
  success: boolean;
  started: boolean;
  alreadyActive: boolean;
  source: EstimateTriggerSource;
  clientId: string;
  leadId: string;
  scheduledCount: number;
  reason?: string;
}

async function getActiveEstimateSequenceCount(
  clientId: string,
  leadId: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: scheduledMessages.id })
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.clientId, clientId),
        eq(scheduledMessages.leadId, leadId),
        eq(scheduledMessages.sequenceType, 'estimate_followup'),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      )
    );

  return rows.length;
}

export function shouldStartEstimateFollowup(
  activeSequenceCount: number,
  force: boolean
): boolean {
  if (force) return true;
  return activeSequenceCount === 0;
}

export async function triggerEstimateFollowup({
  clientId,
  leadId,
  source,
  force = false,
}: TriggerEstimateFollowupInput): Promise<TriggerEstimateFollowupResult> {
  const db = getDb();

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)))
    .limit(1);

  if (!lead) {
    return {
      success: false,
      started: false,
      alreadyActive: false,
      source,
      clientId,
      leadId,
      scheduledCount: 0,
      reason: 'Lead not found for client',
    };
  }

  const activeSequenceCount = await getActiveEstimateSequenceCount(clientId, leadId);
  if (!shouldStartEstimateFollowup(activeSequenceCount, force)) {
    return {
      success: true,
      started: false,
      alreadyActive: true,
      source,
      clientId,
      leadId,
      scheduledCount: activeSequenceCount,
      reason: 'Estimate follow-up sequence already active',
    };
  }

  const result = await startEstimateFollowup({ clientId, leadId });
  if (!result.success) {
    return {
      success: false,
      started: false,
      alreadyActive: false,
      source,
      clientId,
      leadId,
      scheduledCount: 0,
      reason: result.reason || 'Failed to start estimate follow-up sequence',
    };
  }

  return {
    success: true,
    started: true,
    alreadyActive: false,
    source,
    clientId,
    leadId,
    scheduledCount: result.scheduledCount || 0,
  };
}
