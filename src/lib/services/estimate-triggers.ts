import { getDb } from '@/db';
import { leads, scheduledMessages } from '@/db/schema';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { parseEstimateCommand } from '@/lib/services/estimate-command-parser';

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

interface LeadLookupCandidate {
  id: string;
  name: string | null;
  phone: string;
}

type LeadResolution =
  | { status: 'resolved'; lead: LeadLookupCandidate }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: LeadLookupCandidate[] };

export interface EstimateSmsCommandResult {
  handled: boolean;
  success: boolean;
  leadId?: string;
  message: string;
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

export function resolveDeterministicLeadCandidates(
  candidates: LeadLookupCandidate[]
): LeadResolution {
  if (candidates.length === 0) return { status: 'not_found' };
  if (candidates.length === 1) return { status: 'resolved', lead: candidates[0] };
  return { status: 'ambiguous', candidates };
}

function formatLeadLabel(lead: LeadLookupCandidate): string {
  return lead.name ? `${lead.name} (${lead.phone})` : lead.phone;
}

function buildAmbiguousLeadMessage(candidates: LeadLookupCandidate[]): string {
  const preview = candidates.slice(0, 3).map(formatLeadLabel).join('; ');
  return `Multiple leads match that command: ${preview}. Reply with EST <phone> or EST <lead-id>.`;
}

async function findLeadByCommandTarget(
  clientId: string,
  targetType: 'lead_id' | 'phone' | 'lead_name',
  target: string
): Promise<LeadResolution> {
  const db = getDb();

  if (targetType === 'lead_id') {
    const [lead] = await db
      .select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(and(eq(leads.clientId, clientId), eq(leads.id, target)))
      .limit(1);

    return resolveDeterministicLeadCandidates(lead ? [lead] : []);
  }

  if (targetType === 'phone') {
    const normalizedPhone = normalizePhoneNumber(target);
    const [lead] = await db
      .select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(and(eq(leads.clientId, clientId), eq(leads.phone, normalizedPhone)))
      .limit(1);

    return resolveDeterministicLeadCandidates(lead ? [lead] : []);
  }

  const exactNameMatches = await db
    .select({ id: leads.id, name: leads.name, phone: leads.phone })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        sql`lower(${leads.name}) = lower(${target})`
      )
    )
    .limit(5);

  const exactResolution = resolveDeterministicLeadCandidates(exactNameMatches);
  if (exactResolution.status !== 'not_found') {
    return exactResolution;
  }

  const partialNameMatches = await db
    .select({ id: leads.id, name: leads.name, phone: leads.phone })
    .from(leads)
    .where(and(eq(leads.clientId, clientId), ilike(leads.name, `%${target}%`)))
    .limit(5);

  return resolveDeterministicLeadCandidates(partialNameMatches);
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

export async function triggerEstimateFollowupFromSmsCommand(params: {
  clientId: string;
  messageBody: string;
}): Promise<EstimateSmsCommandResult> {
  const parsed = parseEstimateCommand(params.messageBody);
  if (!parsed.matched) {
    return {
      handled: false,
      success: false,
      message: '',
    };
  }

  if (parsed.error === 'missing_target') {
    return {
      handled: true,
      success: false,
      message: 'Use: EST <lead-id|lead-name|phone>',
    };
  }

  if (!parsed.target || !parsed.targetType) {
    return {
      handled: true,
      success: false,
      message: 'Could not parse command. Use: EST <lead-id|lead-name|phone>',
    };
  }

  const leadResolution = await findLeadByCommandTarget(
    params.clientId,
    parsed.targetType,
    parsed.target
  );

  if (leadResolution.status === 'not_found') {
    return {
      handled: true,
      success: false,
      message: 'No matching lead found. Use EST <lead-id|lead-name|phone>.',
    };
  }

  if (leadResolution.status === 'ambiguous') {
    return {
      handled: true,
      success: false,
      message: buildAmbiguousLeadMessage(leadResolution.candidates),
    };
  }

  const triggerResult = await triggerEstimateFollowup({
    clientId: params.clientId,
    leadId: leadResolution.lead.id,
    source: 'sms_keyword',
  });

  if (!triggerResult.success) {
    return {
      handled: true,
      success: false,
      leadId: leadResolution.lead.id,
      message:
        triggerResult.reason ||
        'Unable to start estimate follow-up. Please try again from the dashboard.',
    };
  }

  if (triggerResult.alreadyActive) {
    return {
      handled: true,
      success: true,
      leadId: leadResolution.lead.id,
      message: `Estimate follow-up is already active for ${formatLeadLabel(leadResolution.lead)}.`,
    };
  }

  return {
    handled: true,
    success: true,
    leadId: leadResolution.lead.id,
    message: `Started estimate follow-up for ${formatLeadLabel(leadResolution.lead)}.`,
  };
}
