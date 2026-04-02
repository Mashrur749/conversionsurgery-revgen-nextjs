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
import { leads, clients } from '@/db/schema';
import { eq, and, gte, lt, inArray, sql } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ── Thresholds ────────────────────────────────────────────────────────────────

const ESTIMATE_THRESHOLD_DAYS = 21;
const WON_LOST_THRESHOLD_DAYS = 30;
const MIN_CLIENT_AGE_DAYS = 60; // only check signal 2 for clients this old

export interface EngagementHealth {
  clientId: string;
  status: 'healthy' | 'at_risk' | 'disengaged';
  signals: {
    daysSinceLastEstimateFlag: number | null;
    daysSinceLastWonLost: number | null;
  };
  recommendations: string[];
}

export interface EngagementHealthSummary {
  checked: number;
  healthy: number;
  atRisk: number;
  disengaged: number;
  alertsSent: number;
  errors: string[];
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

  return {
    clientId,
    status,
    signals: {
      daysSinceLastEstimateFlag,
      daysSinceLastWonLost,
    },
    recommendations,
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
      parts.push('Consider proactive check-in.');

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
