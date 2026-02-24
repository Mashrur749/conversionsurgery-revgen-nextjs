import { getDb } from '@/db';
import { conversations, leads } from '@/db/schema';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

const INBOUND_LEAD_SOURCES = ['missed_call', 'form', 'sms', 'inbound_sms'] as const;

export interface QualifiedLeadEngagementMetrics {
  count: number;
  qualifiedLeadIds: string[];
}

interface CandidateLead {
  id: string;
  createdAt: Date;
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
  const [firstOutbound] = await db
    .select({
      createdAt: conversations.createdAt,
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
    .orderBy(asc(conversations.createdAt))
    .limit(1);

  return firstOutbound?.createdAt ?? null;
}

export async function hasInboundReplyAfterSystemResponse(
  leadId: string,
  firstSystemResponseAt: Date,
  proofWindowEnd: Date
): Promise<boolean> {
  const db = getDb();
  const [reply] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, leadId),
        eq(conversations.direction, 'inbound'),
        gte(conversations.createdAt, firstSystemResponseAt),
        lte(conversations.createdAt, proofWindowEnd)
      )
    )
    .limit(1);

  return !!reply;
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

