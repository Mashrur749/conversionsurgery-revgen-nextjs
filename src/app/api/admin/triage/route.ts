import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients, leads, escalationQueue, knowledgeGaps, scheduledMessages } from '@/db/schema';
import { eq, and, inArray, gte, lt, or, sql, count as countFn } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

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
}

function computeHealth(row: Omit<TriageClientRow, 'healthStatus' | 'actionNeeded'>): {
  healthStatus: 'green' | 'yellow' | 'red';
  actionNeeded: string[];
} {
  const actions: string[] = [];
  let isRed = false;
  let isYellow = false;

  // Red conditions
  if (row.overdueEscalations > 0) {
    isRed = true;
    actions.push(`${row.overdueEscalations} escalation${row.overdueEscalations > 1 ? 's' : ''} open 24+ hours`);
  }

  // For clients over 60 days old, 0 estimate flags in 30+ days is red
  const clientAgeDays =
    (Date.now() - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (
    clientAgeDays >= 60 &&
    (row.daysSinceEstimate === null || row.daysSinceEstimate >= 30)
  ) {
    isRed = true;
    actions.push(
      row.daysSinceEstimate === null
        ? 'No estimate activity recorded'
        : `${row.daysSinceEstimate}d since last estimate sent`
    );
  }

  // Yellow conditions (only if not already red for that signal)
  if (row.openKbGaps >= 5) {
    isYellow = true;
    actions.push(`${row.openKbGaps} open KB gaps`);
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
  }

  if (row.daysSinceWonOrLost !== null && row.daysSinceWonOrLost >= 30) {
    isYellow = true;
    actions.push(`${row.daysSinceWonOrLost}d since last win/loss update`);
  }

  const healthStatus = isRed ? 'red' : isYellow ? 'yellow' : 'green';
  return { healthStatus, actionNeeded: actions };
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

    // Batch all queries — no N+1
    const [
      escalationCounts,
      overdueEscalationCounts,
      kbGapCounts,
      recentEstimates,
      recentWonLost,
      smartAssistPendingCounts,
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
    ]);

    // Index all results by clientId for O(1) lookup
    const escalationMap = new Map(escalationCounts.map((r) => [r.clientId, Number(r.count)]));
    const overdueMap = new Map(overdueEscalationCounts.map((r) => [r.clientId, Number(r.count)]));
    const kbGapMap = new Map(kbGapCounts.map((r) => [r.clientId, Number(r.count)]));
    const estimateMap = new Map(recentEstimates.map((r) => [r.clientId, r.mostRecentAt]));
    const wonLostMap = new Map(recentWonLost.map((r) => [r.clientId, r.mostRecentAt]));
    const smartAssistMap = new Map(smartAssistPendingCounts.map((r) => [r.clientId, Number(r.count)]));

    function daysSince(dateStr: string | undefined): number | null {
      if (!dateStr) return null;
      const ms = now.getTime() - new Date(dateStr).getTime();
      return Math.floor(ms / (1000 * 60 * 60 * 24));
    }

    const rows: TriageClientRow[] = activeClients.map((c) => {
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
      };
      const { healthStatus, actionNeeded } = computeHealth(baseRow);
      return { ...baseRow, healthStatus, actionNeeded };
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
