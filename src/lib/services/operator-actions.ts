import { getDb } from '@/db';
import {
  escalationQueue,
  clients,
  knowledgeGaps,
  subscriptions,
  auditLog,
} from '@/db/schema';
import { and, eq, inArray, lt, lte, sql, count, min, max, not, isNull, gte } from 'drizzle-orm';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OperatorAction {
  id: string; // deterministic: `${type}_${clientId}`
  type: string;
  clientId: string;
  clientName: string;
  urgency: 'red' | 'yellow' | 'green';
  title: string;
  detail: string;
  actionUrl: string;
  createdAt: Date;
}

export interface OperatorActionsResult {
  actions: OperatorAction[];
  summary: { red: number; yellow: number; total: number };
}

// ---------------------------------------------------------------------------
// Internal result shapes
// ---------------------------------------------------------------------------

interface EscalationRow {
  clientId: string;
  businessName: string;
  escalationCount: number;
  oldestCreatedAt: Date;
}

interface KbGapRow {
  clientId: string;
  businessName: string;
  gapCount: number;
  oldestFirstSeen: Date;
}

interface GuaranteeRow {
  clientId: string;
  businessName: string;
  guaranteeRecoveryEndsAt: Date;
}

interface DigestResponseRow {
  clientId: string;
  businessName: string;
  pendingCount: number;
  oldestUpdatedAt: Date;
}

interface CallPrepRow {
  clientId: string;
  businessName: string;
  createdAt: Date;
}

interface OnboardingGateRow {
  clientId: string;
  businessName: string;
  exclusionListReviewed: boolean;
  forwardingVerificationStatus: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function fetchEscalationPending(): Promise<OperatorAction[]> {
  const db = getDb();

  const rows = await db
    .select({
      clientId: escalationQueue.clientId,
      businessName: clients.businessName,
      escalationCount: count(escalationQueue.id),
      oldestCreatedAt: min(escalationQueue.createdAt),
    })
    .from(escalationQueue)
    .innerJoin(clients, eq(escalationQueue.clientId, clients.id))
    .where(
      and(
        inArray(escalationQueue.status, ['pending', 'assigned']),
        eq(clients.status, 'active')
      )
    )
    .groupBy(escalationQueue.clientId, clients.businessName);

  const now = Date.now();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  return rows.map((row): OperatorAction => {
    const oldest = row.oldestCreatedAt ?? new Date();
    const ageMs = now - oldest.getTime();
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    const urgency: 'red' | 'yellow' = ageMs > twentyFourHoursMs ? 'red' : 'yellow';

    return {
      id: `escalation_pending_${row.clientId}`,
      type: 'escalation_pending',
      clientId: row.clientId,
      clientName: row.businessName,
      urgency,
      title: `${row.escalationCount} pending escalation${row.escalationCount !== 1 ? 's' : ''}`,
      detail: `Oldest: ${ageHours}h ago`,
      actionUrl: '/admin/escalations',
      createdAt: oldest,
    };
  });
}

async function fetchOnboardingGatePending(): Promise<OperatorAction[]> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      clientId: clients.id,
      businessName: clients.businessName,
      exclusionListReviewed: clients.exclusionListReviewed,
      forwardingVerificationStatus: clients.forwardingVerificationStatus,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        gte(clients.createdAt, thirtyDaysAgo)
      )
    );

  return rows
    .filter(
      (row) =>
        row.exclusionListReviewed === false ||
        row.forwardingVerificationStatus !== 'passed'
    )
    .map((row): OperatorAction => {
      const pendingGates: string[] = [];
      if (!row.exclusionListReviewed) pendingGates.push('exclusion list review');
      if (row.forwardingVerificationStatus !== 'passed')
        pendingGates.push('forwarding verification');

      return {
        id: `onboarding_gate_pending_${row.clientId}`,
        type: 'onboarding_gate_pending',
        clientId: row.clientId,
        clientName: row.businessName,
        urgency: 'yellow',
        title: 'Onboarding gates incomplete',
        detail: `Pending: ${pendingGates.join(', ')}`,
        actionUrl: `/admin/clients/${row.clientId}`,
        createdAt: row.createdAt,
      };
    });
}

async function fetchForwardingFailed(): Promise<OperatorAction[]> {
  const db = getDb();

  const rows = await db
    .select({
      clientId: clients.id,
      businessName: clients.businessName,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        eq(clients.forwardingVerificationStatus, 'failed')
      )
    );

  return rows.map((row): OperatorAction => ({
    id: `forwarding_failed_${row.clientId}`,
    type: 'forwarding_failed',
    clientId: row.clientId,
    clientName: row.businessName,
    urgency: 'yellow',
    title: 'Call forwarding failed',
    detail: 'Verification call did not connect',
    actionUrl: `/admin/clients/${row.clientId}`,
    createdAt: row.createdAt,
  }));
}

async function fetchKbGapsAccumulating(): Promise<OperatorAction[]> {
  const db = getDb();

  const rows = await db
    .select({
      clientId: knowledgeGaps.clientId,
      businessName: clients.businessName,
      gapCount: count(knowledgeGaps.id),
      oldestFirstSeen: min(knowledgeGaps.firstSeenAt),
    })
    .from(knowledgeGaps)
    .innerJoin(clients, eq(knowledgeGaps.clientId, clients.id))
    .where(
      and(
        eq(knowledgeGaps.status, 'new'),
        eq(clients.status, 'active')
      )
    )
    .groupBy(knowledgeGaps.clientId, clients.businessName)
    .having(gte(count(knowledgeGaps.id), 5));

  return rows.map((row): OperatorAction => ({
    id: `kb_gaps_accumulating_${row.clientId}`,
    type: 'kb_gaps_accumulating',
    clientId: row.clientId,
    clientName: row.businessName,
    urgency: 'yellow',
    title: `${row.gapCount} unanswered KB gap${row.gapCount !== 1 ? 's' : ''}`,
    detail: `${row.gapCount} unresolved questions need knowledge base entries`,
    actionUrl: `/admin/clients/${row.clientId}/knowledge`,
    createdAt: row.oldestFirstSeen ?? new Date(),
  }));
}

async function fetchDigestResponsesPending(): Promise<OperatorAction[]> {
  const db = getDb();

  const rows = await db
    .select({
      clientId: knowledgeGaps.clientId,
      businessName: clients.businessName,
      pendingCount: count(knowledgeGaps.id),
      oldestUpdatedAt: min(knowledgeGaps.lastSeenAt),
    })
    .from(knowledgeGaps)
    .innerJoin(clients, eq(knowledgeGaps.clientId, clients.id))
    .where(
      and(
        eq(knowledgeGaps.status, 'in_review'),
        eq(clients.status, 'active')
      )
    )
    .groupBy(knowledgeGaps.clientId, clients.businessName);

  return rows
    .filter((row) => row.pendingCount > 0)
    .map((row): OperatorAction => ({
      id: `digest_responses_pending_${row.clientId}`,
      type: 'digest_responses_pending',
      clientId: row.clientId,
      clientName: row.businessName,
      urgency: 'yellow',
      title: `${row.pendingCount} digest response${row.pendingCount !== 1 ? 's' : ''} to review`,
      detail: `Contractor answered ${row.pendingCount} KB gap${row.pendingCount !== 1 ? 's' : ''} via SMS — verify and approve`,
      actionUrl: `/admin/clients/${row.clientId}/knowledge`,
      createdAt: row.oldestUpdatedAt ?? new Date(),
    }));
}

async function fetchGuaranteeApproaching(): Promise<OperatorAction[]> {
  const db = getDb();
  const now = new Date();
  const twentyDaysFromNow = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      clientId: subscriptions.clientId,
      businessName: clients.businessName,
      guaranteeRecoveryEndsAt: subscriptions.guaranteeRecoveryEndsAt,
      guaranteeStatus: subscriptions.guaranteeStatus,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(clients, eq(subscriptions.clientId, clients.id))
    .where(
      and(
        eq(clients.status, 'active'),
        not(isNull(subscriptions.guaranteeRecoveryEndsAt)),
        not(inArray(subscriptions.guaranteeStatus, ['fulfilled', 'recovery_passed'])),
        gte(subscriptions.guaranteeRecoveryEndsAt, now),
        lte(subscriptions.guaranteeRecoveryEndsAt, twentyDaysFromNow)
      )
    );

  return rows.map((row): OperatorAction => {
    const endsAt = row.guaranteeRecoveryEndsAt!;
    const daysRemaining = Math.ceil(
      (endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const urgency: 'red' | 'yellow' = endsAt <= tenDaysFromNow ? 'red' : 'yellow';

    return {
      id: `guarantee_approaching_${row.clientId}`,
      type: 'guarantee_approaching',
      clientId: row.clientId,
      clientName: row.businessName,
      urgency,
      title: 'Guarantee window closing',
      detail: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`,
      actionUrl: `/admin/clients/${row.clientId}`,
      createdAt: row.createdAt,
    };
  });
}

// engagement_flagged: skip for now — depends on Task 2 (engagement signals service).
// Will be wired after `getEngagementSignals()` exists in engagement-signals.ts.

async function fetchCallPrepDue(): Promise<OperatorAction[]> {
  const db = getDb();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Active clients that have been active for 14+ days
  const activeClients = await db
    .select({
      clientId: clients.id,
      businessName: clients.businessName,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        lte(clients.createdAt, fourteenDaysAgo)
      )
    );

  if (activeClients.length === 0) return [];

  const clientIds = activeClients.map((c) => c.clientId);

  // Find clients that DO have a call_prep_viewed audit entry in the last 14 days
  const recentCallPrep = await db
    .select({ clientId: auditLog.clientId })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, clientIds),
        eq(auditLog.action, 'call_prep_viewed'),
        gte(auditLog.createdAt, fourteenDaysAgo)
      )
    );

  const clientsWithRecentPrep = new Set(
    recentCallPrep.map((r) => r.clientId).filter((id): id is string => id !== null)
  );

  return activeClients
    .filter((c) => !clientsWithRecentPrep.has(c.clientId))
    .map((c): OperatorAction => ({
      id: `call_prep_due_${c.clientId}`,
      type: 'call_prep_due',
      clientId: c.clientId,
      clientName: c.businessName,
      urgency: 'yellow',
      title: 'Bi-weekly call prep due',
      detail: 'No call prep reviewed in the last 14 days',
      actionUrl: `/admin/clients/${c.clientId}/call-prep`,
      createdAt: c.createdAt,
    }));
}

// ---------------------------------------------------------------------------
// Main aggregation function
// ---------------------------------------------------------------------------

export async function getOperatorActions(): Promise<OperatorActionsResult> {
  const [
    escalationActions,
    onboardingActions,
    forwardingActions,
    kbGapActions,
    digestResponseActions,
    guaranteeActions,
    callPrepActions,
  ] = await Promise.all([
    fetchEscalationPending().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] escalation_pending query failed:', err, {});
      return [] as OperatorAction[];
    }),
    fetchOnboardingGatePending().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] onboarding_gate_pending query failed:', err, {});
      return [] as OperatorAction[];
    }),
    fetchForwardingFailed().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] forwarding_failed query failed:', err, {});
      return [] as OperatorAction[];
    }),
    fetchKbGapsAccumulating().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] kb_gaps_accumulating query failed:', err, {});
      return [] as OperatorAction[];
    }),
    fetchDigestResponsesPending().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] digest_responses_pending query failed:', err, {});
      return [] as OperatorAction[];
    }),
    fetchGuaranteeApproaching().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] guarantee_approaching query failed:', err, {});
      return [] as OperatorAction[];
    }),
    fetchCallPrepDue().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] call_prep_due query failed:', err, {});
      return [] as OperatorAction[];
    }),
  ]);

  const all: OperatorAction[] = [
    ...escalationActions,
    ...onboardingActions,
    ...forwardingActions,
    ...kbGapActions,
    ...digestResponseActions,
    ...guaranteeActions,
    ...callPrepActions,
  ];

  // Sort: red first, then yellow, then by oldest createdAt ascending
  const urgencyOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  all.sort((a, b) => {
    const urgencyDiff = (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2);
    if (urgencyDiff !== 0) return urgencyDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const summary = {
    red: all.filter((a) => a.urgency === 'red').length,
    yellow: all.filter((a) => a.urgency === 'yellow').length,
    total: all.length,
  };

  return { actions: all, summary };
}
