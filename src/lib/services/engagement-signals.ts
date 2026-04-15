/**
 * Engagement Signals Service (FMA 5.2)
 *
 * Computes 5 deterministic per-client engagement indicators, each independently
 * green / yellow / red. Results are used by the triage dashboard to surface
 * clients that need operator attention.
 *
 * Feature flag: `engagementSignals` — if disabled, all signals return green.
 */

import { getDb } from '@/db';
import { leads, knowledgeGaps, agencyMessages } from '@/db/schema';
import { eq, and, gte, lt, inArray, max, count, isNotNull } from 'drizzle-orm';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SignalStatus = 'green' | 'yellow' | 'red';

export interface EngagementSignal {
  key: string;
  label: string;
  status: SignalStatus;
  /** Human-readable value, e.g. "12 days ago" or "65%" */
  value: string;
  /** Threshold description, e.g. "Green < 7d, Yellow 7-14d, Red > 14d" */
  threshold: string;
}

export interface EngagementSignalsResult {
  signals: EngagementSignal[];
  /** true if 4+ of 5 signals are yellow or red */
  flagged: boolean;
  greenCount: number;
  yellowCount: number;
  redCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDays(days: number | null): string {
  if (days === null) return 'Never';
  return `${days} days ago`;
}

function formatPct(numerator: number, denominator: number): string {
  if (denominator === 0) return 'No data';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

// ── Status classifiers ────────────────────────────────────────────────────────

function estRecencyStatus(days: number | null): SignalStatus {
  if (days === null) return 'yellow'; // no data ≠ bad data
  if (days < 7) return 'green';
  if (days <= 14) return 'yellow';
  return 'red';
}

function wonLostRecencyStatus(days: number | null): SignalStatus {
  if (days === null) return 'yellow';
  if (days < 14) return 'green';
  if (days <= 21) return 'yellow';
  return 'red';
}

function kbGapStatus(numerator: number, denominator: number): SignalStatus {
  if (denominator === 0) return 'yellow';
  const pct = numerator / denominator;
  if (pct > 0.7) return 'green';
  if (pct >= 0.3) return 'yellow';
  return 'red';
}

function nudgeStatus(numerator: number, denominator: number): SignalStatus {
  if (denominator === 0) return 'yellow';
  const pct = numerator / denominator;
  if (pct > 0.5) return 'green';
  if (pct >= 0.2) return 'yellow';
  return 'red';
}

/** Same thresholds as estRecency: < 7d green, 7-14d yellow, > 14d red */
const contractorContactStatus = estRecencyStatus;

function volumeTrendStatus(currentCount: number, priorCount: number): SignalStatus {
  // No baseline — new client, can't compare
  if (priorCount === 0) return 'green';
  // Severe drop: volume went to zero from 5+, or dropped 75%+
  if ((currentCount === 0 && priorCount >= 5) || currentCount < priorCount * 0.25) return 'red';
  // Significant drop: 50%+ decline AND at least 3 fewer leads
  if (currentCount < priorCount * 0.5 && priorCount - currentCount >= 3) return 'yellow';
  return 'green';
}

// ── All-green result (used when feature flag is disabled) ─────────────────────

function allGreenResult(): EngagementSignalsResult {
  const signals: EngagementSignal[] = [
    {
      key: 'est_recency',
      label: 'Estimate trigger recency',
      status: 'green',
      value: 'N/A',
      threshold: 'Green < 7d, Yellow 7-14d, Red > 14d',
    },
    {
      key: 'won_lost_recency',
      label: 'WON/LOST recency',
      status: 'green',
      value: 'N/A',
      threshold: 'Green < 14d, Yellow 14-21d, Red > 21d',
    },
    {
      key: 'kb_gap_response',
      label: 'KB gap response rate',
      status: 'green',
      value: 'N/A',
      threshold: 'Green > 70%, Yellow 30-70%, Red < 30%',
    },
    {
      key: 'nudge_response',
      label: 'Nudge response rate',
      status: 'green',
      value: 'N/A',
      threshold: 'Green > 50%, Yellow 20-50%, Red < 20%',
    },
    {
      key: 'contractor_contact',
      label: 'Last contractor contact',
      status: 'green',
      value: 'N/A',
      threshold: 'Green < 7d, Yellow 7-14d, Red > 14d',
    },
    {
      key: 'lead_volume_trend',
      label: 'Lead volume trend (30d vs prior 30d)',
      status: 'green',
      value: 'N/A',
      threshold: 'Green: stable/growing, Yellow: -50%+ (3+ drop), Red: -75%+ or zero from 5+',
    },
  ];
  return { signals, flagged: false, greenCount: 6, yellowCount: 0, redCount: 0 };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getEngagementSignals(
  clientId: string
): Promise<EngagementSignalsResult> {
  const enabled = await resolveFeatureFlag(clientId, 'engagementSignals');
  if (!enabled) return allGreenResult();

  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Run all underlying queries in parallel (including volume check)
  const [
    estRecencyRow,
    wonLostRecencyRow,
    kbTotalRow,
    kbResolvedRow,
    nudgeTotalRow,
    nudgeRespondedRow,
    contractorContactRow,
    recentLeadCountRow,
    priorLeadCountRow,
  ] = await Promise.all([
    // 1. Estimate trigger recency — latest updatedAt for active leads
    db
      .select({ lastUpdated: max(leads.updatedAt) })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          inArray(leads.status, ['estimate_sent', 'appointment_set', 'won'])
        )
      )
      .then((rows) => rows[0] ?? null),

    // 2. WON/LOST recency — latest updatedAt for closed leads
    db
      .select({ lastUpdated: max(leads.updatedAt) })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          inArray(leads.status, ['won', 'lost'])
        )
      )
      .then((rows) => rows[0] ?? null),

    // 3a. KB gap total count
    db
      .select({ total: count() })
      .from(knowledgeGaps)
      .where(eq(knowledgeGaps.clientId, clientId))
      .then((rows) => rows[0] ?? { total: 0 }),

    // 3b. KB gap resolved/verified count
    db
      .select({ resolved: count() })
      .from(knowledgeGaps)
      .where(
        and(
          eq(knowledgeGaps.clientId, clientId),
          inArray(knowledgeGaps.status, ['resolved', 'verified'])
        )
      )
      .then((rows) => rows[0] ?? { resolved: 0 }),

    // 4a. Nudge messages sent in last 30 days
    db
      .select({ total: count() })
      .from(agencyMessages)
      .where(
        and(
          eq(agencyMessages.clientId, clientId),
          inArray(agencyMessages.promptType, [
            'probable_wins_batch',
            'quote_prompt',
            'daily_digest',
          ]),
          gte(agencyMessages.createdAt, thirtyDaysAgo)
        )
      )
      .then((rows) => rows[0] ?? { total: 0 }),

    // 4b. Nudge messages where contractor responded (actionStatus is not null)
    db
      .select({ responded: count() })
      .from(agencyMessages)
      .where(
        and(
          eq(agencyMessages.clientId, clientId),
          inArray(agencyMessages.promptType, [
            'probable_wins_batch',
            'quote_prompt',
            'daily_digest',
          ]),
          gte(agencyMessages.createdAt, thirtyDaysAgo),
          isNotNull(agencyMessages.actionStatus)
        )
      )
      .then((rows) => rows[0] ?? { responded: 0 }),

    // 5. Last contractor contact — latest inbound message timestamp
    db
      .select({ lastContact: max(agencyMessages.createdAt) })
      .from(agencyMessages)
      .where(
        and(
          eq(agencyMessages.clientId, clientId),
          eq(agencyMessages.direction, 'inbound')
        )
      )
      .then((rows) => rows[0] ?? null),

    // 6. Volume check — new leads in last 30 days (for low-volume dampening)
    db
      .select({ value: count() })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          gte(leads.createdAt, thirtyDaysAgo)
        )
      )
      .then((rows) => rows[0] ?? { value: 0 }),

    // 7. Prior period lead count (31-60 days ago) — for volume trend signal
    db
      .select({ value: count() })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          gte(leads.createdAt, new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)),
          lt(leads.createdAt, thirtyDaysAgo)
        )
      )
      .then((rows) => rows[0] ?? { value: 0 }),
  ]);

  // ── Build signals ─────────────────────────────────────────────────────────

  const estDays = daysSince(estRecencyRow?.lastUpdated ?? null);
  const signal1: EngagementSignal = {
    key: 'est_recency',
    label: 'Estimate trigger recency',
    status: estRecencyStatus(estDays),
    value: formatDays(estDays),
    threshold: 'Green < 7d, Yellow 7-14d, Red > 14d',
  };

  const wonLostDays = daysSince(wonLostRecencyRow?.lastUpdated ?? null);
  const signal2: EngagementSignal = {
    key: 'won_lost_recency',
    label: 'WON/LOST recency',
    status: wonLostRecencyStatus(wonLostDays),
    value: formatDays(wonLostDays),
    threshold: 'Green < 14d, Yellow 14-21d, Red > 21d',
  };

  const kbTotal = kbTotalRow.total;
  const kbResolved = kbResolvedRow.resolved;
  const signal3: EngagementSignal = {
    key: 'kb_gap_response',
    label: 'KB gap response rate',
    status: kbGapStatus(kbResolved, kbTotal),
    value: formatPct(kbResolved, kbTotal),
    threshold: 'Green > 70%, Yellow 30-70%, Red < 30%',
  };

  const nudgeTotal = nudgeTotalRow.total;
  const nudgeResponded = nudgeRespondedRow.responded;
  const signal4: EngagementSignal = {
    key: 'nudge_response',
    label: 'Nudge response rate',
    status: nudgeStatus(nudgeResponded, nudgeTotal),
    value: formatPct(nudgeResponded, nudgeTotal),
    threshold: 'Green > 50%, Yellow 20-50%, Red < 20%',
  };

  const contactDays = daysSince(contractorContactRow?.lastContact ?? null);
  const signal5: EngagementSignal = {
    key: 'contractor_contact',
    label: 'Last contractor contact',
    status: contractorContactStatus(contactDays),
    value: formatDays(contactDays),
    threshold: 'Green < 7d, Yellow 7-14d, Red > 14d',
  };

  const currentLeadCount = Number(recentLeadCountRow.value);
  const priorLeadCount = Number(priorLeadCountRow.value);
  const signal6: EngagementSignal = {
    key: 'lead_volume_trend',
    label: 'Lead volume trend (30d vs prior 30d)',
    status: volumeTrendStatus(currentLeadCount, priorLeadCount),
    value: `${currentLeadCount} vs ${priorLeadCount}`,
    threshold: 'Green: stable/growing, Yellow: -50%+ (3+ drop), Red: -75%+ or zero from 5+',
  };

  // ── Volume-awareness dampening ─────────────────────────────────────────────
  // Only dampen when there are literally zero leads — volume-trend signal now
  // captures genuine seasonal decline, so dampening threshold is tightened.
  if (currentLeadCount < 1) {
    if (signal1.status === 'red') signal1.status = 'yellow';
    if (signal2.status === 'red') signal2.status = 'yellow';
  }

  const signals = [signal1, signal2, signal3, signal4, signal5, signal6];

  const greenCount = signals.filter((s) => s.status === 'green').length;
  const yellowCount = signals.filter((s) => s.status === 'yellow').length;
  const redCount = signals.filter((s) => s.status === 'red').length;
  const flagged = yellowCount + redCount >= 4;

  return { signals, flagged, greenCount, yellowCount, redCount };
}
