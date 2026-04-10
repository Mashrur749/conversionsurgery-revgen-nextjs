/**
 * Engagement Health Service (GAP-03)
 *
 * Detects contractor disengagement per client by monitoring queryable signals
 * from the leads table:
 *   1. No estimate flags in 21+ days
 *   2. No won/lost status updates in 30+ days (only for clients 60+ days old)
 *
 * Runs weekly (Monday) via the cron orchestrator.
 */

import { getDb } from '@/db';
import { leads, clients, dailyStats, conversations, voiceCalls } from '@/db/schema';
import { eq, and, gte, lt, inArray, sql, sum } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ── Thresholds ────────────────────────────────────────────────────────────────

const ESTIMATE_THRESHOLD_DAYS = 21;
const WON_LOST_THRESHOLD_DAYS = 30;
const MIN_CLIENT_AGE_DAYS = 60; // only check signal 2 for clients this old

export interface RootCauseHints {
  /** Inbound missed-call volume change vs prior week: positive = up, negative = down (percentage) */
  inboundCallTrendPct: number | null;
  /** Fraction of inbound lead conversations where AI responded (0–1), last 14 days. Null if no data. */
  aiSuccessRate: number | null;
  /** Count of inbound voice calls with outcome voicemail/dropped in last 7 days */
  unansweredMissedCalls: number | null;
  /** Suggested next action for the operator */
  suggestedIntervention: string;
}

export interface EngagementHealth {
  clientId: string;
  status: 'healthy' | 'at_risk' | 'disengaged';
  signals: {
    daysSinceLastEstimateFlag: number | null;
    daysSinceLastWonLost: number | null;
  };
  recommendations: string[];
  /** Populated for at_risk / disengaged clients — null for healthy */
  rootCause: RootCauseHints | null;
}

export interface EngagementHealthSummary {
  checked: number;
  healthy: number;
  atRisk: number;
  disengaged: number;
  alertsSent: number;
  errors: string[];
}

// ── Root cause analysis ───────────────────────────────────────────────────────

async function computeRootCause(clientId: string, now: Date): Promise<RootCauseHints> {
  const db = getDb();

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ISO date strings (YYYY-MM-DD) for the date column
  const todayStr = now.toISOString().split('T')[0];
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

  // ── Signal A: inbound call volume trend (last 7d vs prior 7d) ────────────
  const [callVolumeCurrent, callVolumePrior] = await Promise.all([
    db
      .select({ total: sum(dailyStats.missedCallsCaptured) })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, clientId),
          gte(dailyStats.date, sevenDaysAgoStr),
          lt(dailyStats.date, todayStr)
        )
      ),
    db
      .select({ total: sum(dailyStats.missedCallsCaptured) })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, clientId),
          gte(dailyStats.date, fourteenDaysAgoStr),
          lt(dailyStats.date, sevenDaysAgoStr)
        )
      ),
  ]);

  const currentCalls = Number(callVolumeCurrent[0]?.total ?? 0);
  const priorCalls = Number(callVolumePrior[0]?.total ?? 0);

  let inboundCallTrendPct: number | null = null;
  if (priorCalls > 0) {
    inboundCallTrendPct = Math.round(((currentCalls - priorCalls) / priorCalls) * 100);
  }

  // ── Signal B: AI conversation success rate (last 14d) ────────────────────
  // Success = AI responded to a lead's inbound message (ai_response vs total inbound leads)
  const [aiResponseResult, totalInboundResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${conversations.leadId})` })
      .from(conversations)
      .where(
        and(
          eq(conversations.clientId, clientId),
          eq(conversations.messageType, 'ai_response'),
          gte(conversations.createdAt, fourteenDaysAgo)
        )
      ),
    db
      .select({ count: sql<number>`count(distinct ${conversations.leadId})` })
      .from(conversations)
      .where(
        and(
          eq(conversations.clientId, clientId),
          eq(conversations.direction, 'inbound'),
          gte(conversations.createdAt, fourteenDaysAgo)
        )
      ),
  ]);

  const aiResponded = Number(aiResponseResult[0]?.count ?? 0);
  const totalLeadsWithInbound = Number(totalInboundResult[0]?.count ?? 0);
  const aiSuccessRate =
    totalLeadsWithInbound > 0
      ? Math.round((aiResponded / totalLeadsWithInbound) * 100) / 100
      : null;

  // ── Signal C: unanswered missed calls (last 7d) ───────────────────────────
  const [unansweredResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(voiceCalls)
    .where(
      and(
        eq(voiceCalls.clientId, clientId),
        eq(voiceCalls.direction, 'inbound'),
        inArray(voiceCalls.outcome, ['voicemail', 'dropped']),
        gte(voiceCalls.createdAt, sevenDaysAgo)
      )
    );

  const unansweredMissedCalls = Number(unansweredResult?.count ?? 0);

  // ── Build suggested intervention ──────────────────────────────────────────
  let suggestedIntervention = 'Schedule a proactive check-in call with the contractor.';

  if (inboundCallTrendPct !== null && inboundCallTrendPct <= -40) {
    suggestedIntervention = `Check voice routing — inbound call volume dropped ${Math.abs(inboundCallTrendPct)}% this week.`;
  } else if (unansweredMissedCalls >= 3) {
    suggestedIntervention = `${unansweredMissedCalls} missed calls went unanswered — verify voice routing and callback workflow.`;
  } else if (aiSuccessRate !== null && aiSuccessRate < 0.5 && totalLeadsWithInbound > 5) {
    suggestedIntervention =
      'AI response rate is low — review KB gaps and consider updating the knowledge base.';
  } else if (inboundCallTrendPct !== null && inboundCallTrendPct <= -20) {
    suggestedIntervention = 'Consider launching a Growth Blitz campaign to re-engage lead flow.';
  }

  return {
    inboundCallTrendPct,
    aiSuccessRate,
    unansweredMissedCalls,
    suggestedIntervention,
  };
}

// ── Per-client check ──────────────────────────────────────────────────────────

/**
 * Checks engagement health for a single client.
 * Returns null if the client is not found or not active.
 */
export async function checkEngagementHealth(clientId: string): Promise<EngagementHealth | null> {
  const db = getDb();

  const [client] = await db
    .select({ id: clients.id, createdAt: clients.createdAt })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.status, 'active')))
    .limit(1);

  if (!client) return null;

  const now = new Date();

  // ── Signal 1: days since last estimate_sent ───────────────────────────────
  const [estimateRow] = await db
    .select({
      lastAt: sql<Date | null>`max(${leads.updatedAt})`.as('last_estimate_at'),
    })
    .from(leads)
    .where(and(eq(leads.clientId, clientId), eq(leads.status, 'estimate_sent')));

  let daysSinceLastEstimateFlag: number | null = null;
  if (estimateRow?.lastAt) {
    const ms = now.getTime() - new Date(estimateRow.lastAt).getTime();
    daysSinceLastEstimateFlag = Math.floor(ms / (1000 * 60 * 60 * 24));
  } else {
    // No estimate ever sent — treat as maximally stale
    const clientAgeMs = now.getTime() - new Date(client.createdAt).getTime();
    daysSinceLastEstimateFlag = Math.floor(clientAgeMs / (1000 * 60 * 60 * 24));
  }

  // ── Signal 2: days since last won/lost (only for 60+ day old clients) ────
  const clientAgeDays = Math.floor(
    (now.getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  let daysSinceLastWonLost: number | null = null;

  if (clientAgeDays >= MIN_CLIENT_AGE_DAYS) {
    const [wonLostRow] = await db
      .select({
        lastAt: sql<Date | null>`max(${leads.updatedAt})`.as('last_won_lost_at'),
      })
      .from(leads)
      .where(
        and(eq(leads.clientId, clientId), inArray(leads.status, ['won', 'lost']))
      );

    if (wonLostRow?.lastAt) {
      const ms = now.getTime() - new Date(wonLostRow.lastAt).getTime();
      daysSinceLastWonLost = Math.floor(ms / (1000 * 60 * 60 * 24));
    } else {
      // Client is old enough but has never closed a lead
      daysSinceLastWonLost = clientAgeDays;
    }
  }

  // ── Evaluate signals ──────────────────────────────────────────────────────
  const estimateBreached =
    daysSinceLastEstimateFlag !== null && daysSinceLastEstimateFlag >= ESTIMATE_THRESHOLD_DAYS;

  const wonLostBreached =
    daysSinceLastWonLost !== null && daysSinceLastWonLost >= WON_LOST_THRESHOLD_DAYS;

  let status: EngagementHealth['status'];
  if (estimateBreached && wonLostBreached) {
    status = 'disengaged';
  } else if (estimateBreached || wonLostBreached) {
    status = 'at_risk';
  } else {
    status = 'healthy';
  }

  // ── Build recommendations ─────────────────────────────────────────────────
  const recommendations: string[] = [];
  if (estimateBreached) {
    recommendations.push(
      `No estimate flags in ${daysSinceLastEstimateFlag} days — remind contractor to flag sent estimates.`
    );
  }
  if (wonLostBreached) {
    recommendations.push(
      `No won/lost updates in ${daysSinceLastWonLost} days — coach contractor on closing the loop.`
    );
  }
  if (status === 'healthy') {
    recommendations.push('All engagement signals within healthy thresholds.');
  }

  // ── Root cause analysis (at_risk / disengaged only) ──────────────────────
  let rootCause: RootCauseHints | null = null;
  if (status !== 'healthy') {
    rootCause = await computeRootCause(clientId, now);
  }

  return {
    clientId,
    status,
    signals: {
      daysSinceLastEstimateFlag,
      daysSinceLastWonLost,
    },
    recommendations,
    rootCause,
  };
}

// ── Weekly batch runner ───────────────────────────────────────────────────────

/**
 * Runs the engagement health check for all active clients created 60+ days ago.
 * Sends an SMS alert via `sendAlert()` for any at_risk or disengaged clients.
 */
export async function runEngagementHealthCheck(): Promise<EngagementHealthSummary> {
  const db = getDb();
  const errors: string[] = [];

  const cutoff = new Date(Date.now() - MIN_CLIENT_AGE_DAYS * 24 * 60 * 60 * 1000);

  const activeClients = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(and(eq(clients.status, 'active'), lt(clients.createdAt, cutoff)));

  const summary: EngagementHealthSummary = {
    checked: activeClients.length,
    healthy: 0,
    atRisk: 0,
    disengaged: 0,
    alertsSent: 0,
    errors,
  };

  for (const client of activeClients) {
    try {
      const health = await checkEngagementHealth(client.id);
      if (!health) continue;

      if (health.status === 'healthy') {
        summary.healthy++;
        continue;
      }

      if (health.status === 'at_risk') summary.atRisk++;
      if (health.status === 'disengaged') summary.disengaged++;

      // Build alert message
      const parts: string[] = [`Engagement alert: ${client.businessName}`];
      if (health.signals.daysSinceLastEstimateFlag !== null) {
        parts.push(`no estimate flags in ${health.signals.daysSinceLastEstimateFlag} days`);
      }
      if (health.signals.daysSinceLastWonLost !== null) {
        parts.push(`no won/lost updates in ${health.signals.daysSinceLastWonLost} days`);
      }
      if (health.rootCause?.suggestedIntervention) {
        parts.push(health.rootCause.suggestedIntervention);
      } else {
        parts.push('Consider proactive check-in.');
      }

      await sendAlert({
        clientId: client.id,
        message: parts.join(', '),
        isUrgent: false,
      });

      summary.alertsSent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Client ${client.id}: ${msg}`);
      logSanitizedConsoleError('[EngagementHealth] Error checking client:', err, {
        clientId: client.id,
      });
    }
  }

  return summary;
}
