import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients, leads, escalationQueue, knowledgeGaps, scheduledMessages, leadContext, aiHealthReports } from '@/db/schema';
import { eq, and, inArray, gte, lt, or, sql, count as countFn, desc } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getSmartAssistCorrectionRate } from '@/lib/services/smart-assist-learning';

export interface TriageTrigger {
  /** Human-readable trigger label */
  label: string;
  /** Detail with threshold context, e.g. "Last estimate sent: 22d ago (threshold: 21d)" */
  detail: string;
  severity: 'red' | 'yellow';
}

/** Conversation stage distribution for a single client */
export interface StageDistribution {
  total: number;
  greeting: number;
  qualifying: number;
  presenting: number;
  objectionHandling: number;
  closing: number;
  nurturing: number;
  other: number;
}

export interface TriageClientRow {
  id: string;
  businessName: string;
  status: string | null;
  createdAt: string;
  openEscalations: number;
  overdueEscalations: number; // pending 24+ hours
  openKbGaps: number;
  daysSinceEstimate: number | null;
  daysSinceWonOrLost: number | null;
  pendingSmartAssistDrafts: number;
  healthStatus: 'green' | 'yellow' | 'red';
  actionNeeded: string[];
  /** Structured trigger details for richer card display */
  triggers: TriageTrigger[];
  /**
   * Approximate days this client has been at the current health status,
   * derived from how long each breaching signal has exceeded its threshold.
   * Null for healthy clients.
   */
  daysAtCurrentStatus: number | null;
  /** Conversation stage distribution across all active leads (last 30d) */
  stageDistribution: StageDistribution;
  /** Percentage of Smart Assist drafts corrected before sending (0-100) */
  correctionRate: number;
  /** Number of opt-outs in the last 7 days */
  recentOptOuts: number;
  /** Whether the latest AI health report has any alerts */
  hasHealthAlert: boolean;
}

function computeHealth(
  row: Omit<TriageClientRow, 'healthStatus' | 'actionNeeded' | 'triggers' | 'daysAtCurrentStatus'>
): {
  healthStatus: 'green' | 'yellow' | 'red';
  actionNeeded: string[];
  triggers: TriageTrigger[];
  daysAtCurrentStatus: number | null;
} {
  const actions: string[] = [];
  const triggers: TriageTrigger[] = [];
  let isRed = false;
  let isYellow = false;

  // Track how many days beyond each threshold (proxy for "time at this status")
  const daysOverThreshold: number[] = [];

  // Red conditions
  if (row.overdueEscalations > 0) {
    isRed = true;
    const label = `${row.overdueEscalations} escalation${row.overdueEscalations > 1 ? 's' : ''} open 24+ hours`;
    actions.push(label);
    triggers.push({
      label: 'Overdue escalations',
      detail: `${row.overdueEscalations} open escalation${row.overdueEscalations > 1 ? 's' : ''} waiting 24+ hours (threshold: 24h)`,
      severity: 'red',
    });
    daysOverThreshold.push(1); // at least 1 day over
  }

  // For clients over 60 days old, no estimate flags in 30+ days is red
  const clientAgeDays =
    (Date.now() - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24);

  if (
    clientAgeDays >= 60 &&
    (row.daysSinceEstimate === null || row.daysSinceEstimate >= 30)
  ) {
    isRed = true;
    if (row.daysSinceEstimate === null) {
      actions.push('No estimate activity recorded');
      triggers.push({
        label: 'No estimate activity',
        detail: 'No estimate ever recorded (threshold: 30d)',
        severity: 'red',
      });
      daysOverThreshold.push(Math.max(0, Math.floor(clientAgeDays) - 30));
    } else {
      actions.push(`${row.daysSinceEstimate}d since last estimate sent`);
      triggers.push({
        label: 'Stale estimate activity',
        detail: `Last estimate sent: ${row.daysSinceEstimate}d ago (threshold: 30d)`,
        severity: 'red',
      });
      daysOverThreshold.push(row.daysSinceEstimate - 30);
    }
  }

  // Yellow conditions (only if not already red for that signal)
  if (row.openKbGaps >= 5) {
    isYellow = true;
    actions.push(`${row.openKbGaps} open KB gaps`);
    triggers.push({
      label: 'Open KB gaps',
      detail: `${row.openKbGaps} unresolved knowledge gaps (threshold: 5)`,
      severity: 'yellow',
    });
    daysOverThreshold.push(0);
  }

  if (
    !isRed &&
    clientAgeDays >= 60 &&
    row.daysSinceEstimate !== null &&
    row.daysSinceEstimate >= 21 &&
    row.daysSinceEstimate < 30
  ) {
    isYellow = true;
    actions.push(`${row.daysSinceEstimate}d since last estimate sent`);
    triggers.push({
      label: 'Estimate activity slowing',
      detail: `Last estimate sent: ${row.daysSinceEstimate}d ago (threshold: 21d)`,
      severity: 'yellow',
    });
    daysOverThreshold.push(row.daysSinceEstimate - 21);
  }

  if (row.daysSinceWonOrLost !== null && row.daysSinceWonOrLost >= 30) {
    isYellow = true;
    actions.push(`${row.daysSinceWonOrLost}d since last win/loss update`);
    triggers.push({
      label: 'No win/loss updates',
      detail: `No won/lost in ${row.daysSinceWonOrLost}d (threshold: 30d)`,
      severity: 'yellow',
    });
    daysOverThreshold.push(row.daysSinceWonOrLost - 30);
  }

  const healthStatus = isRed ? 'red' : isYellow ? 'yellow' : 'green';

  // daysAtCurrentStatus = max days any single signal has been over its threshold
  const daysAtCurrentStatus =
    daysOverThreshold.length > 0 ? Math.max(0, ...daysOverThreshold) : null;

  return { healthStatus, actionNeeded: actions, triggers, daysAtCurrentStatus };
}

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const db = getDb();

    // Fetch all active clients
    const activeClients = await db
      .select({
        id: clients.id,
        businessName: clients.businessName,
        status: clients.status,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(eq(clients.status, 'active'));

    if (activeClients.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    const clientIds = activeClients.map((c) => c.id);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Batch all queries — no N+1
    const [
      escalationCounts,
      overdueEscalationCounts,
      kbGapCounts,
      recentEstimates,
      recentWonLost,
      smartAssistPendingCounts,
      stageDistributionRows,
      recentOptOutRows,
      latestHealthReports,
    ] = await Promise.all([
      // Open escalations per client (pending or in_progress)
      db
        .select({
          clientId: escalationQueue.clientId,
          count: countFn(),
        })
        .from(escalationQueue)
        .where(
          and(
            inArray(escalationQueue.clientId, clientIds),
            inArray(escalationQueue.status, ['pending', 'in_progress'])
          )
        )
        .groupBy(escalationQueue.clientId),

      // Overdue escalations: pending status, created 24+ hours ago
      db
        .select({
          clientId: escalationQueue.clientId,
          count: countFn(),
        })
        .from(escalationQueue)
        .where(
          and(
            inArray(escalationQueue.clientId, clientIds),
            inArray(escalationQueue.status, ['pending', 'in_progress']),
            lt(escalationQueue.createdAt, oneDayAgo)
          )
        )
        .groupBy(escalationQueue.clientId),

      // Open KB gaps per client
      db
        .select({
          clientId: knowledgeGaps.clientId,
          count: countFn(),
        })
        .from(knowledgeGaps)
        .where(
          and(
            inArray(knowledgeGaps.clientId, clientIds),
            or(
              eq(knowledgeGaps.status, 'new'),
              eq(knowledgeGaps.status, 'in_review')
            )
          )
        )
        .groupBy(knowledgeGaps.clientId),

      // Most recent estimate_sent lead per client (last 90 days)
      db
        .select({
          clientId: leads.clientId,
          mostRecentAt: sql<string>`max(${leads.updatedAt})`.as('most_recent_at'),
        })
        .from(leads)
        .where(
          and(
            inArray(leads.clientId, clientIds),
            eq(leads.status, 'estimate_sent'),
            gte(leads.updatedAt, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
          )
        )
        .groupBy(leads.clientId),

      // Most recent won or lost lead per client (last 90 days)
      db
        .select({
          clientId: leads.clientId,
          mostRecentAt: sql<string>`max(${leads.updatedAt})`.as('most_recent_at'),
        })
        .from(leads)
        .where(
          and(
            inArray(leads.clientId, clientIds),
            inArray(leads.status, ['won', 'lost']),
            gte(leads.updatedAt, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
          )
        )
        .groupBy(leads.clientId),

      // Smart Assist drafts awaiting operator approval per client
      db
        .select({
          clientId: scheduledMessages.clientId,
          count: countFn(),
        })
        .from(scheduledMessages)
        .where(
          and(
            inArray(scheduledMessages.clientId, clientIds),
            eq(scheduledMessages.assistStatus, 'pending_approval'),
            eq(scheduledMessages.sent, false),
            eq(scheduledMessages.cancelled, false)
          )
        )
        .groupBy(scheduledMessages.clientId),

      // Conversation stage distribution per client
      db
        .select({
          clientId: leadContext.clientId,
          conversationStage: leadContext.conversationStage,
          count: countFn(),
        })
        .from(leadContext)
        .where(inArray(leadContext.clientId, clientIds))
        .groupBy(leadContext.clientId, leadContext.conversationStage),

      // Recent opt-outs (last 7 days) per client
      db
        .select({
          clientId: leads.clientId,
          count: countFn(),
        })
        .from(leads)
        .where(
          and(
            inArray(leads.clientId, clientIds),
            eq(leads.optedOut, true),
            gte(leads.optedOutAt, sevenDaysAgo)
          )
        )
        .groupBy(leads.clientId),

      // Latest AI health report per client (global — not per client, so just fetch the latest)
      db
        .select({
          id: aiHealthReports.id,
          alerts: aiHealthReports.alerts,
          createdAt: aiHealthReports.createdAt,
        })
        .from(aiHealthReports)
        .orderBy(desc(aiHealthReports.createdAt))
        .limit(1),
    ]);

    // Index all results by clientId for O(1) lookup
    const escalationMap = new Map(escalationCounts.map((r) => [r.clientId, Number(r.count)]));
    const overdueMap = new Map(overdueEscalationCounts.map((r) => [r.clientId, Number(r.count)]));
    const kbGapMap = new Map(kbGapCounts.map((r) => [r.clientId, Number(r.count)]));
    const estimateMap = new Map(recentEstimates.map((r) => [r.clientId, r.mostRecentAt]));
    const wonLostMap = new Map(recentWonLost.map((r) => [r.clientId, r.mostRecentAt]));
    const smartAssistMap = new Map(smartAssistPendingCounts.map((r) => [r.clientId, Number(r.count)]));
    const optOutMap = new Map(recentOptOutRows.map((r) => [r.clientId, Number(r.count)]));

    // Build stage distribution map keyed by clientId
    const stageDistMap = new Map<string, StageDistribution>();
    for (const row of stageDistributionRows) {
      const existing = stageDistMap.get(row.clientId) ?? {
        total: 0, greeting: 0, qualifying: 0, presenting: 0,
        objectionHandling: 0, closing: 0, nurturing: 0, other: 0,
      };
      const cnt = Number(row.count);
      existing.total += cnt;
      const stage = row.conversationStage ?? 'other';
      if (stage === 'greeting') existing.greeting += cnt;
      else if (stage === 'qualifying') existing.qualifying += cnt;
      else if (stage === 'presenting') existing.presenting += cnt;
      else if (stage === 'objection_handling') existing.objectionHandling += cnt;
      else if (stage === 'closing') existing.closing += cnt;
      else if (stage === 'nurturing') existing.nurturing += cnt;
      else existing.other += cnt;
      stageDistMap.set(row.clientId, existing);
    }

    // Latest global health report alerts (shared across all clients — one report for the whole system)
    const latestReport = latestHealthReports[0] ?? null;
    const hasHealthAlert = latestReport !== null && Array.isArray(latestReport.alerts) && latestReport.alerts.length > 0;

    // Fetch correction rates for all clients in parallel (uses existing service)
    const correctionRates = await Promise.all(
      clientIds.map((clientId) =>
        getSmartAssistCorrectionRate(clientId, thirtyDaysAgo).then((r) => ({ clientId, rate: r.rate }))
      )
    );
    const correctionRateMap = new Map(correctionRates.map((r) => [r.clientId, r.rate]));

    function daysSince(dateStr: string | undefined): number | null {
      if (!dateStr) return null;
      const ms = now.getTime() - new Date(dateStr).getTime();
      return Math.floor(ms / (1000 * 60 * 60 * 24));
    }

    const emptyStageDistribution: StageDistribution = {
      total: 0, greeting: 0, qualifying: 0, presenting: 0,
      objectionHandling: 0, closing: 0, nurturing: 0, other: 0,
    };

    const rows: TriageClientRow[] = activeClients.map((c) => {
      const rawRate = correctionRateMap.get(c.id) ?? 0;
      const baseRow = {
        id: c.id,
        businessName: c.businessName,
        status: c.status,
        createdAt: c.createdAt!.toISOString(),
        openEscalations: escalationMap.get(c.id) ?? 0,
        overdueEscalations: overdueMap.get(c.id) ?? 0,
        openKbGaps: kbGapMap.get(c.id) ?? 0,
        daysSinceEstimate: daysSince(estimateMap.get(c.id)),
        daysSinceWonOrLost: daysSince(wonLostMap.get(c.id)),
        pendingSmartAssistDrafts: smartAssistMap.get(c.id) ?? 0,
        stageDistribution: stageDistMap.get(c.id) ?? { ...emptyStageDistribution },
        correctionRate: Math.round(rawRate * 100),
        recentOptOuts: optOutMap.get(c.id) ?? 0,
        hasHealthAlert,
      };
      const { healthStatus, actionNeeded, triggers, daysAtCurrentStatus } = computeHealth(baseRow);
      return { ...baseRow, healthStatus, actionNeeded, triggers, daysAtCurrentStatus };
    });

    // Sort: red first, then yellow, then green; within tier by overdue escalations desc
    const tierOrder = { red: 0, yellow: 1, green: 2 };
    rows.sort((a, b) => {
      const tierDiff = tierOrder[a.healthStatus] - tierOrder[b.healthStatus];
      if (tierDiff !== 0) return tierDiff;
      return b.overdueEscalations - a.overdueEscalations;
    });

    return NextResponse.json({ clients: rows });
  }
);
