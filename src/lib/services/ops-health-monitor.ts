/**
 * Ops Health Monitor (FMA 6.1)
 *
 * Provides circuit breaker logic, rate anomaly detection, and health badge
 * computation for the ops cockpit and heartbeat check.
 */

import { getDb } from '@/db';
import { cronJobCursors, auditLog, agencyMessages } from '@/db/schema';
import { eq, and, gte, gt, or, like, count } from 'drizzle-orm';
import {
  isOpsKillSwitchEnabled,
  OPS_KILL_SWITCH_KEYS,
} from '@/lib/services/ops-kill-switches';

export interface HealthBadge {
  status: 'green' | 'yellow' | 'red';
  details: string[];
  activeCircuitBreakers: string[];
}

// ── Function 1: getHealthBadge ────────────────────────────────────────────────

export async function getHealthBadge(): Promise<HealthBadge> {
  const db = getDb();

  // 1. Query cron job cursors for failures or backlogs
  const failedOrBacklogged = await db
    .select({
      jobKey: cronJobCursors.jobKey,
      status: cronJobCursors.status,
      backlogCount: cronJobCursors.backlogCount,
    })
    .from(cronJobCursors)
    .where(
      or(
        eq(cronJobCursors.status, 'failed'),
        gt(cronJobCursors.backlogCount, 0),
      ),
    );

  // 2. Check ops kill switches in parallel
  const [outboundAutomations, smartAssistAutoSend, voiceAi] = await Promise.all([
    isOpsKillSwitchEnabled(OPS_KILL_SWITCH_KEYS.OUTBOUND_AUTOMATIONS),
    isOpsKillSwitchEnabled(OPS_KILL_SWITCH_KEYS.SMART_ASSIST_AUTO_SEND),
    isOpsKillSwitchEnabled(OPS_KILL_SWITCH_KEYS.VOICE_AI),
  ]);

  // 3. Check rate anomaly
  const rateAnomaly = await checkRateAnomaly();

  // 4. Build details and circuit breakers list
  const details: string[] = [];
  const activeCircuitBreakers: string[] = [];

  // Kill switch details
  if (outboundAutomations) {
    details.push('Kill switch active: outbound automations are paused');
    activeCircuitBreakers.push('OUTBOUND_AUTOMATIONS');
  }
  if (smartAssistAutoSend) {
    details.push('Kill switch active: smart assist auto-send is paused');
    activeCircuitBreakers.push('SMART_ASSIST_AUTO_SEND');
  }
  if (voiceAi) {
    details.push('Kill switch active: voice AI is paused');
    activeCircuitBreakers.push('VOICE_AI');
  }

  // Rate anomaly details
  if (rateAnomaly.anomaly && rateAnomaly.detail) {
    details.push(`Rate anomaly detected: ${rateAnomaly.detail}`);
  }

  // Cron failure/backlog details
  for (const cursor of failedOrBacklogged) {
    if (cursor.status === 'failed') {
      details.push(`Cron job failed: ${cursor.jobKey}`);
    } else if (cursor.backlogCount > 0) {
      details.push(
        `Cron job backlogged: ${cursor.jobKey} (${cursor.backlogCount} period${cursor.backlogCount === 1 ? '' : 's'} behind)`,
      );
    }
  }

  // 5. Determine status
  const hasKillSwitch = outboundAutomations || smartAssistAutoSend || voiceAi;
  const hasCronIssue = failedOrBacklogged.length > 0;

  let status: 'green' | 'yellow' | 'red';
  if (hasKillSwitch || rateAnomaly.anomaly) {
    status = 'red';
  } else if (hasCronIssue) {
    status = 'yellow';
  } else {
    status = 'green';
  }

  if (status === 'green') {
    details.push('All systems operational');
  }

  return { status, details, activeCircuitBreakers };
}

// ── Function 2: checkClientCircuitBreaker ────────────────────────────────────

export async function checkClientCircuitBreaker(
  clientId: string,
): Promise<{ tripped: boolean; reason?: string }> {
  const db = getDb();

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Count distinct action values matching error/failed patterns for this client in last 24h
  const rows = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.clientId, clientId),
        gte(auditLog.createdAt, twentyFourHoursAgo),
        or(
          like(auditLog.action, '%error%'),
          like(auditLog.action, '%failed%'),
        ),
      ),
    );

  // Deduplicate action values in application code
  const distinctActions = new Set(rows.map((r) => r.action));
  const distinctCount = distinctActions.size;

  if (distinctCount >= 3) {
    return {
      tripped: true,
      reason: `${distinctCount} distinct automation errors in last 24h`,
    };
  }

  return { tripped: false };
}

// ── Function 3: checkRateAnomaly ─────────────────────────────────────────────

export async function checkRateAnomaly(): Promise<{
  anomaly: boolean;
  detail?: string;
}> {
  const db = getDb();

  // Today's start in UTC
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // 7 days ago
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Count today's outbound messages
  const [todayRow] = await db
    .select({ total: count() })
    .from(agencyMessages)
    .where(
      and(
        eq(agencyMessages.direction, 'outbound'),
        gte(agencyMessages.createdAt, todayStart),
      ),
    );

  // Count last 7 days' outbound messages (excluding today to get the rolling average)
  const [weekRow] = await db
    .select({ total: count() })
    .from(agencyMessages)
    .where(
      and(
        eq(agencyMessages.direction, 'outbound'),
        gte(agencyMessages.createdAt, sevenDaysAgo),
      ),
    );

  const todayCount = todayRow?.total ?? 0;
  // Divide 7-day total by 7 for daily average (includes today in denominator intentionally
  // to be conservative — avoids false positives early in the day)
  const weekTotal = weekRow?.total ?? 0;
  const dailyAverage = weekTotal / 7;

  // Avoid false alarms on low volume (daily average <= 10)
  if (dailyAverage <= 10) {
    return { anomaly: false };
  }

  if (todayCount > 2 * dailyAverage) {
    return {
      anomaly: true,
      detail: `Today: ${todayCount} outbound messages vs daily average of ${Math.round(dailyAverage)}`,
    };
  }

  return { anomaly: false };
}
