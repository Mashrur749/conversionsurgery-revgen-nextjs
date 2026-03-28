/**
 * AI Effectiveness Metrics — aggregation queries for the observability dashboard.
 *
 * Reads from `agent_decisions` to compute outcome distributions, confidence bands,
 * model tier usage, action effectiveness, and time-series trends.
 */
import { getDb } from '@/db';
import { agentDecisions } from '@/db/schema';
import { and, count, avg, eq, gte, lte, sql, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutcomeDistribution {
  outcome: string;
  count: number;
  percentage: number;
}

export interface ActionEffectiveness {
  action: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  pending: number;
  positiveRate: number;
}

export interface ConfidenceBand {
  band: string;
  min: number;
  max: number;
  total: number;
  positive: number;
  positiveRate: number;
  avgProcessingMs: number;
}

export interface ModelTierMetrics {
  tier: string;
  total: number;
  positive: number;
  positiveRate: number;
  avgProcessingMs: number;
  avgConfidence: number;
}

export interface DailyTrend {
  date: string;
  total: number;
  positive: number;
  positiveRate: number;
  avgConfidence: number;
  avgProcessingMs: number;
}

export interface AiEffectivenessSnapshot {
  period: { start: string; end: string };
  totalDecisions: number;
  avgConfidence: number;
  avgProcessingMs: number;
  positiveRate: number;
  outcomeDistribution: OutcomeDistribution[];
  actionEffectiveness: ActionEffectiveness[];
  confidenceBands: ConfidenceBand[];
  modelTierMetrics: ModelTierMetrics[];
  dailyTrend: DailyTrend[];
  topEscalationReasons: Array<{ reason: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

/**
 * Compute the full AI effectiveness snapshot for a given date range.
 * If `clientId` is provided, scope to that client only.
 */
export async function getAiEffectivenessSnapshot(opts: {
  startDate: Date;
  endDate: Date;
  clientId?: string;
}): Promise<AiEffectivenessSnapshot> {
  const db = getDb();
  const { startDate, endDate, clientId } = opts;

  const baseWhere = clientId
    ? and(
        gte(agentDecisions.createdAt, startDate),
        lte(agentDecisions.createdAt, endDate),
        eq(agentDecisions.clientId, clientId)
      )
    : and(
        gte(agentDecisions.createdAt, startDate),
        lte(agentDecisions.createdAt, endDate)
      );

  // Run all queries in parallel
  const [
    summaryRows,
    outcomeRows,
    actionRows,
    confidenceRows,
    modelTierRows,
    dailyRows,
    escalationRows,
  ] = await Promise.all([
    // 1. Summary aggregates
    db
      .select({
        total: count(),
        avgConfidence: avg(agentDecisions.confidence),
        avgProcessingMs: avg(agentDecisions.processingTimeMs),
      })
      .from(agentDecisions)
      .where(baseWhere),

    // 2. Outcome distribution
    db
      .select({
        outcome: sql<string>`COALESCE(${agentDecisions.outcome}, 'pending')`,
        count: count(),
      })
      .from(agentDecisions)
      .where(baseWhere)
      .groupBy(sql`COALESCE(${agentDecisions.outcome}, 'pending')`),

    // 3. Action effectiveness
    db
      .select({
        action: agentDecisions.action,
        total: count(),
        positive: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'positive')`,
        negative: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'negative')`,
        neutral: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'neutral')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} IS NULL OR ${agentDecisions.outcome} = 'pending')`,
      })
      .from(agentDecisions)
      .where(baseWhere)
      .groupBy(agentDecisions.action)
      .orderBy(desc(count())),

    // 4. Confidence bands
    db
      .select({
        band: sql<string>`CASE
          WHEN ${agentDecisions.confidence} < 40 THEN 'low'
          WHEN ${agentDecisions.confidence} < 60 THEN 'medium-low'
          WHEN ${agentDecisions.confidence} < 80 THEN 'medium-high'
          ELSE 'high'
        END`,
        min: sql<number>`MIN(${agentDecisions.confidence})`,
        max: sql<number>`MAX(${agentDecisions.confidence})`,
        total: count(),
        positive: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'positive')`,
        avgProcessingMs: avg(agentDecisions.processingTimeMs),
      })
      .from(agentDecisions)
      .where(baseWhere)
      .groupBy(
        sql`CASE
          WHEN ${agentDecisions.confidence} < 40 THEN 'low'
          WHEN ${agentDecisions.confidence} < 60 THEN 'medium-low'
          WHEN ${agentDecisions.confidence} < 80 THEN 'medium-high'
          ELSE 'high'
        END`
      ),

    // 5. Model tier metrics (from actionDetails jsonb)
    db
      .select({
        tier: sql<string>`COALESCE(${agentDecisions.actionDetails}->>'modelTier', 'unknown')`,
        total: count(),
        positive: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'positive')`,
        avgProcessingMs: avg(agentDecisions.processingTimeMs),
        avgConfidence: avg(agentDecisions.confidence),
      })
      .from(agentDecisions)
      .where(baseWhere)
      .groupBy(sql`COALESCE(${agentDecisions.actionDetails}->>'modelTier', 'unknown')`),

    // 6. Daily trend
    db
      .select({
        date: sql<string>`DATE(${agentDecisions.createdAt})`,
        total: count(),
        positive: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'positive')`,
        avgConfidence: avg(agentDecisions.confidence),
        avgProcessingMs: avg(agentDecisions.processingTimeMs),
      })
      .from(agentDecisions)
      .where(baseWhere)
      .groupBy(sql`DATE(${agentDecisions.createdAt})`)
      .orderBy(sql`DATE(${agentDecisions.createdAt})`),

    // 7. Top escalation reasons
    db
      .select({
        reason: sql<string>`${agentDecisions.actionDetails}->>'escalationReason'`,
        count: count(),
      })
      .from(agentDecisions)
      .where(
        clientId
          ? and(
              gte(agentDecisions.createdAt, startDate),
              lte(agentDecisions.createdAt, endDate),
              eq(agentDecisions.clientId, clientId),
              eq(agentDecisions.action, 'escalate')
            )
          : and(
              gte(agentDecisions.createdAt, startDate),
              lte(agentDecisions.createdAt, endDate),
              eq(agentDecisions.action, 'escalate')
            )
      )
      .groupBy(sql`${agentDecisions.actionDetails}->>'escalationReason'`)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  const totalDecisions = Number(summaryRows[0]?.total ?? 0);
  const avgConfidence = Number(summaryRows[0]?.avgConfidence ?? 0);
  const avgProcessingMs = Number(summaryRows[0]?.avgProcessingMs ?? 0);

  // Compute positive rate from outcome distribution
  const positiveCount =
    outcomeRows.find((r) => r.outcome === 'positive')?.count ?? 0;
  const positiveRate = pct(Number(positiveCount), totalDecisions);

  // Shape outcome distribution
  const outcomeDistribution: OutcomeDistribution[] = outcomeRows.map((r) => ({
    outcome: r.outcome,
    count: Number(r.count),
    percentage: pct(Number(r.count), totalDecisions),
  }));

  // Shape action effectiveness
  const actionEffectiveness: ActionEffectiveness[] = actionRows.map((r) => {
    const total = Number(r.total);
    const positive = Number(r.positive);
    return {
      action: r.action,
      total,
      positive,
      negative: Number(r.negative),
      neutral: Number(r.neutral),
      pending: Number(r.pending),
      positiveRate: pct(positive, total),
    };
  });

  // Shape confidence bands
  const confidenceBands: ConfidenceBand[] = confidenceRows.map((r) => {
    const total = Number(r.total);
    const positive = Number(r.positive);
    return {
      band: r.band,
      min: Number(r.min),
      max: Number(r.max),
      total,
      positive,
      positiveRate: pct(positive, total),
      avgProcessingMs: Math.round(Number(r.avgProcessingMs ?? 0)),
    };
  });

  // Shape model tier metrics
  const modelTierMetrics: ModelTierMetrics[] = modelTierRows.map((r) => {
    const total = Number(r.total);
    const positive = Number(r.positive);
    return {
      tier: r.tier,
      total,
      positive,
      positiveRate: pct(positive, total),
      avgProcessingMs: Math.round(Number(r.avgProcessingMs ?? 0)),
      avgConfidence: Math.round(Number(r.avgConfidence ?? 0)),
    };
  });

  // Shape daily trend
  const dailyTrend: DailyTrend[] = dailyRows.map((r) => {
    const total = Number(r.total);
    const positive = Number(r.positive);
    return {
      date: String(r.date),
      total,
      positive,
      positiveRate: pct(positive, total),
      avgConfidence: Math.round(Number(r.avgConfidence ?? 0)),
      avgProcessingMs: Math.round(Number(r.avgProcessingMs ?? 0)),
    };
  });

  // Shape escalation reasons
  const topEscalationReasons = escalationRows
    .filter((r) => r.reason)
    .map((r) => ({
      reason: r.reason,
      count: Number(r.count),
    }));

  return {
    period: { start: dateStr(startDate), end: dateStr(endDate) },
    totalDecisions,
    avgConfidence: Math.round(avgConfidence),
    avgProcessingMs: Math.round(avgProcessingMs),
    positiveRate,
    outcomeDistribution,
    actionEffectiveness,
    confidenceBands,
    modelTierMetrics,
    dailyTrend,
    topEscalationReasons,
  };
}

/**
 * Lightweight summary for embedding in biweekly client reports.
 * Returns only the metrics relevant to a single client.
 */
export async function getClientAiSummary(opts: {
  clientId: string;
  startDate: Date;
  endDate: Date;
}): Promise<{
  totalDecisions: number;
  avgConfidence: number;
  positiveRate: number;
  topAction: string | null;
  escalationCount: number;
  avgResponseMs: number;
}> {
  const db = getDb();
  const { clientId, startDate, endDate } = opts;

  const where = and(
    eq(agentDecisions.clientId, clientId),
    gte(agentDecisions.createdAt, startDate),
    lte(agentDecisions.createdAt, endDate)
  );

  const [summaryRows, topActionRows, escalationRows] = await Promise.all([
    db
      .select({
        total: count(),
        avgConfidence: avg(agentDecisions.confidence),
        avgProcessingMs: avg(agentDecisions.processingTimeMs),
        positive: sql<number>`COUNT(*) FILTER (WHERE ${agentDecisions.outcome} = 'positive')`,
      })
      .from(agentDecisions)
      .where(where),

    db
      .select({
        action: agentDecisions.action,
        cnt: count(),
      })
      .from(agentDecisions)
      .where(where)
      .groupBy(agentDecisions.action)
      .orderBy(desc(count()))
      .limit(1),

    db
      .select({ cnt: count() })
      .from(agentDecisions)
      .where(
        and(
          eq(agentDecisions.clientId, clientId),
          gte(agentDecisions.createdAt, startDate),
          lte(agentDecisions.createdAt, endDate),
          eq(agentDecisions.action, 'escalate')
        )
      ),
  ]);

  const total = Number(summaryRows[0]?.total ?? 0);
  const positive = Number(summaryRows[0]?.positive ?? 0);

  return {
    totalDecisions: total,
    avgConfidence: Math.round(Number(summaryRows[0]?.avgConfidence ?? 0)),
    positiveRate: pct(positive, total),
    topAction: topActionRows[0]?.action ?? null,
    escalationCount: Number(escalationRows[0]?.cnt ?? 0),
    avgResponseMs: Math.round(Number(summaryRows[0]?.avgProcessingMs ?? 0)),
  };
}
