import { getDb } from '@/db';
import { appointments, conversations, funnelEvents, jobs, leads } from '@/db/schema';
import { and, asc, eq, gte, inArray, lte, or } from 'drizzle-orm';

const INBOUND_LEAD_SOURCES = ['missed_call', 'form', 'sms', 'inbound_sms'] as const;
const MANUAL_OUTBOUND_MESSAGE_TYPES = [
  'contractor_response',
  'manual',
  'hot_transfer',
  'escalation',
] as const;
const RECOVERY_FUNNEL_EVENT_TYPES = ['appointment_booked', 'job_won'] as const;
const JOB_WON_STATUSES = ['won', 'completed'] as const;

export interface QualifiedLeadEngagementMetrics {
  count: number;
  qualifiedLeadIds: string[];
}

export type RecoveryAttributionReason =
  | 'job_won'
  | 'appointment_booked'
  | 'resumed_conversation';

export interface AttributedOpportunity {
  leadId: string;
  reason: RecoveryAttributionReason;
  evidenceAt: Date;
  firstAutomationAt: Date;
}

export interface RecoveryAttributedOpportunityMetrics {
  count: number;
  opportunities: AttributedOpportunity[];
}

interface CandidateLead {
  id: string;
  createdAt: Date;
}

interface AutomatedLeadTouch {
  leadId: string;
  firstAutomationAt: Date;
}

function isAutomatedOutboundMessageType(messageType: string | null): boolean {
  if (!messageType) return true;
  return !MANUAL_OUTBOUND_MESSAGE_TYPES.includes(
    messageType as (typeof MANUAL_OUTBOUND_MESSAGE_TYPES)[number]
  );
}

export async function getProofWindowCandidateLeads(
  clientId: string,
  proofWindowStart: Date,
  proofWindowEnd: Date
): Promise<CandidateLead[]> {
  const db = getDb();
  return db
    .select({
      id: leads.id,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        inArray(leads.source, [...INBOUND_LEAD_SOURCES]),
        gte(leads.createdAt, proofWindowStart),
        lte(leads.createdAt, proofWindowEnd)
      )
    );
}

export async function getFirstSystemResponseAt(
  leadId: string,
  leadCreatedAt: Date,
  proofWindowEnd: Date
): Promise<Date | null> {
  const db = getDb();
  const outboundMessages = await db
    .select({
      createdAt: conversations.createdAt,
      messageType: conversations.messageType,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, leadId),
        eq(conversations.direction, 'outbound'),
        gte(conversations.createdAt, leadCreatedAt),
        lte(conversations.createdAt, proofWindowEnd)
      )
    )
    .orderBy(asc(conversations.createdAt));

  for (const message of outboundMessages) {
    if (isAutomatedOutboundMessageType(message.messageType)) {
      return message.createdAt;
    }
  }

  return null;
}

export async function getFirstInboundReplyAfter(
  leadId: string,
  firstSystemResponseAt: Date,
  proofWindowEnd: Date
): Promise<Date | null> {
  const db = getDb();
  const [reply] = await db
    .select({ createdAt: conversations.createdAt })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, leadId),
        eq(conversations.direction, 'inbound'),
        gte(conversations.createdAt, firstSystemResponseAt),
        lte(conversations.createdAt, proofWindowEnd)
      )
    )
    .orderBy(asc(conversations.createdAt))
    .limit(1);

  return reply?.createdAt ?? null;
}

export async function hasInboundReplyAfterSystemResponse(
  leadId: string,
  firstSystemResponseAt: Date,
  proofWindowEnd: Date
): Promise<boolean> {
  return !!(await getFirstInboundReplyAfter(leadId, firstSystemResponseAt, proofWindowEnd));
}

export async function getRecoveryWindowAutomatedLeadTouches(
  clientId: string,
  recoveryWindowStart: Date,
  recoveryWindowEnd: Date
): Promise<AutomatedLeadTouch[]> {
  const db = getDb();
  const outboundMessages = await db
    .select({
      leadId: conversations.leadId,
      createdAt: conversations.createdAt,
      messageType: conversations.messageType,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.clientId, clientId),
        eq(conversations.direction, 'outbound'),
        gte(conversations.createdAt, recoveryWindowStart),
        lte(conversations.createdAt, recoveryWindowEnd)
      )
    );

  const firstByLead = new Map<string, Date>();
  for (const message of outboundMessages) {
    if (!isAutomatedOutboundMessageType(message.messageType)) continue;
    if (!message.leadId) continue;
    const existing = firstByLead.get(message.leadId);
    if (!existing || message.createdAt < existing) {
      firstByLead.set(message.leadId, message.createdAt);
    }
  }

  return Array.from(firstByLead.entries()).map(([leadId, firstAutomationAt]) => ({
    leadId,
    firstAutomationAt,
  }));
}

export async function countQualifiedLeadEngagements(
  clientId: string,
  proofWindowStart: Date,
  proofWindowEnd: Date
): Promise<QualifiedLeadEngagementMetrics> {
  const candidates = await getProofWindowCandidateLeads(clientId, proofWindowStart, proofWindowEnd);
  const qualifiedLeadIds: string[] = [];

  for (const lead of candidates) {
    const firstSystemResponseAt = await getFirstSystemResponseAt(
      lead.id,
      lead.createdAt,
      proofWindowEnd
    );
    if (!firstSystemResponseAt) continue;

    const hasReply = await hasInboundReplyAfterSystemResponse(
      lead.id,
      firstSystemResponseAt,
      proofWindowEnd
    );
    if (!hasReply) continue;

    qualifiedLeadIds.push(lead.id);
  }

  return {
    count: qualifiedLeadIds.length,
    qualifiedLeadIds,
  };
}

async function getFirstAppointmentOpportunityAt(
  leadId: string,
  firstAutomationAt: Date,
  recoveryWindowEnd: Date
): Promise<Date | null> {
  const db = getDb();
  const [appt] = await db
    .select({ createdAt: appointments.createdAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.leadId, leadId),
        gte(appointments.createdAt, firstAutomationAt),
        lte(appointments.createdAt, recoveryWindowEnd)
      )
    )
    .orderBy(asc(appointments.createdAt))
    .limit(1);

  return appt?.createdAt ?? null;
}

async function getFirstFunnelOpportunityAt(
  leadId: string,
  firstAutomationAt: Date,
  recoveryWindowEnd: Date
): Promise<{ at: Date; type: (typeof RECOVERY_FUNNEL_EVENT_TYPES)[number] } | null> {
  const db = getDb();
  const [event] = await db
    .select({
      createdAt: funnelEvents.createdAt,
      eventType: funnelEvents.eventType,
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.leadId, leadId),
        inArray(funnelEvents.eventType, [...RECOVERY_FUNNEL_EVENT_TYPES]),
        gte(funnelEvents.createdAt, firstAutomationAt),
        lte(funnelEvents.createdAt, recoveryWindowEnd)
      )
    )
    .orderBy(asc(funnelEvents.createdAt))
    .limit(1);

  if (!event) return null;
  return {
    at: event.createdAt,
    type: event.eventType as (typeof RECOVERY_FUNNEL_EVENT_TYPES)[number],
  };
}

async function getFirstJobWonAt(
  leadId: string,
  firstAutomationAt: Date,
  recoveryWindowEnd: Date
): Promise<Date | null> {
  const db = getDb();
  const [job] = await db
    .select({
      wonAt: jobs.wonAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.leadId, leadId),
        inArray(jobs.status, [...JOB_WON_STATUSES]),
        or(
          and(gte(jobs.wonAt, firstAutomationAt), lte(jobs.wonAt, recoveryWindowEnd)),
          and(gte(jobs.updatedAt, firstAutomationAt), lte(jobs.updatedAt, recoveryWindowEnd))
        )
      )
    )
    .orderBy(asc(jobs.updatedAt))
    .limit(1);

  if (!job) return null;
  return job.wonAt ?? job.updatedAt;
}

async function evaluateAttributedOpportunityForLead(
  leadId: string,
  firstAutomationAt: Date,
  recoveryWindowEnd: Date
): Promise<AttributedOpportunity | null> {
  const [jobWonAt, firstAppointmentAt, firstFunnelOpportunity, firstInboundReplyAt] =
    await Promise.all([
      getFirstJobWonAt(leadId, firstAutomationAt, recoveryWindowEnd),
      getFirstAppointmentOpportunityAt(leadId, firstAutomationAt, recoveryWindowEnd),
      getFirstFunnelOpportunityAt(leadId, firstAutomationAt, recoveryWindowEnd),
      getFirstInboundReplyAfter(leadId, firstAutomationAt, recoveryWindowEnd),
    ]);

  const jobWonEvidenceAt =
    firstFunnelOpportunity?.type === 'job_won'
      ? firstFunnelOpportunity.at
      : null;

  if (jobWonAt || jobWonEvidenceAt) {
    return {
      leadId,
      reason: 'job_won',
      evidenceAt: jobWonAt ?? jobWonEvidenceAt!,
      firstAutomationAt,
    };
  }

  const appointmentEvidenceAt =
    firstAppointmentAt ??
    (firstFunnelOpportunity?.type === 'appointment_booked'
      ? firstFunnelOpportunity.at
      : null);
  if (appointmentEvidenceAt) {
    return {
      leadId,
      reason: 'appointment_booked',
      evidenceAt: appointmentEvidenceAt,
      firstAutomationAt,
    };
  }

  if (firstInboundReplyAt) {
    return {
      leadId,
      reason: 'resumed_conversation',
      evidenceAt: firstInboundReplyAt,
      firstAutomationAt,
    };
  }

  return null;
}

export async function countRecoveryAttributedOpportunities(
  clientId: string,
  recoveryWindowStart: Date,
  recoveryWindowEnd: Date
): Promise<RecoveryAttributedOpportunityMetrics> {
  const touches = await getRecoveryWindowAutomatedLeadTouches(
    clientId,
    recoveryWindowStart,
    recoveryWindowEnd
  );
  const opportunities: AttributedOpportunity[] = [];

  for (const touch of touches) {
    const attributed = await evaluateAttributedOpportunityForLead(
      touch.leadId,
      touch.firstAutomationAt,
      recoveryWindowEnd
    );
    if (attributed) {
      opportunities.push(attributed);
    }
  }

  return {
    count: opportunities.length,
    opportunities,
  };
}
