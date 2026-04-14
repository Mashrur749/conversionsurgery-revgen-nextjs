import { getDb } from '@/db';
import { agentDecisions, aiHealthReports } from '@/db/schema';
import { sql, gte, and, lt } from 'drizzle-orm';

interface HealthMetrics {
  confidenceTrend: { current: number; prior: number; delta: number };
  escalationRate: { current: number; prior: number; delta: number };
  outputGuardViolationRate: number;
  avgResponseTimeMs: { current: number; prior: number; delta: number };
  qualityTierUsageRate: { current: number; prior: number; delta: number };
  winBackOptOutRate: number;
  smartAssistCorrectionRate: number;
  voyageFallbackRate: number;
}

interface HealthAlert {
  severity: 'warning' | 'critical';
  metric: string;
  message: string;
  threshold: number;
  actual: number;
}

const THRESHOLDS = {
  confidenceDelta: { warning: -10, critical: -20 },
  escalationRateDelta: { warning: 50, critical: 100 },
  outputGuardViolationRate: { warning: 3, critical: 5 },
  avgResponseTimeMs: { warning: 6000, critical: 10000 },
  qualityTierDelta: { warning: 50, critical: 100 },
  winBackOptOutRate: { warning: 15, critical: 25 },
  smartAssistCorrectionRate: { warning: 30, critical: 50 },
  voyageFallbackRate: { warning: 10, critical: 25 },
} as const;

async function computePeriodMetrics(
  periodStart: Date,
  periodEnd: Date,
): Promise<{ avgConfidence: number; escalationRate: number; avgResponseTime: number; qualityTierRate: number }> {
  const db = getDb();

  const [result] = await db
    .select({
      avgConfidence: sql<number>`coalesce(avg(${agentDecisions.confidence}), 0)`,
      totalDecisions: sql<number>`count(*)`,
      escalations: sql<number>`count(*) filter (where ${agentDecisions.action} = 'escalate')`,
      avgResponseTime: sql<number>`coalesce(avg(${agentDecisions.processingTimeMs}), 0)`,
      qualityTierCount: sql<number>`count(*) filter (where ${agentDecisions.actionDetails}->>'modelTier' = 'quality')`,
    })
    .from(agentDecisions)
    .where(
      and(
        gte(agentDecisions.createdAt, periodStart),
        lt(agentDecisions.createdAt, periodEnd),
      )
    );

  const total = Number(result?.totalDecisions ?? 0);

  return {
    avgConfidence: Number(result?.avgConfidence ?? 0),
    escalationRate: total > 0 ? (Number(result?.escalations ?? 0) / total) * 100 : 0,
    avgResponseTime: Number(result?.avgResponseTime ?? 0),
    qualityTierRate: total > 0 ? (Number(result?.qualityTierCount ?? 0) / total) * 100 : 0,
  };
}

function checkThresholds(metrics: HealthMetrics): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (metrics.confidenceTrend.delta <= THRESHOLDS.confidenceDelta.critical) {
    alerts.push({ severity: 'critical', metric: 'confidence', message: `Confidence dropped ${Math.abs(metrics.confidenceTrend.delta).toFixed(1)}% vs prior week`, threshold: THRESHOLDS.confidenceDelta.critical, actual: metrics.confidenceTrend.delta });
  } else if (metrics.confidenceTrend.delta <= THRESHOLDS.confidenceDelta.warning) {
    alerts.push({ severity: 'warning', metric: 'confidence', message: `Confidence dropped ${Math.abs(metrics.confidenceTrend.delta).toFixed(1)}% vs prior week`, threshold: THRESHOLDS.confidenceDelta.warning, actual: metrics.confidenceTrend.delta });
  }

  if (metrics.escalationRate.delta >= THRESHOLDS.escalationRateDelta.critical) {
    alerts.push({ severity: 'critical', metric: 'escalation_rate', message: `Escalation rate increased ${metrics.escalationRate.delta.toFixed(1)}% vs prior week`, threshold: THRESHOLDS.escalationRateDelta.critical, actual: metrics.escalationRate.delta });
  } else if (metrics.escalationRate.delta >= THRESHOLDS.escalationRateDelta.warning) {
    alerts.push({ severity: 'warning', metric: 'escalation_rate', message: `Escalation rate increased ${metrics.escalationRate.delta.toFixed(1)}% vs prior week`, threshold: THRESHOLDS.escalationRateDelta.warning, actual: metrics.escalationRate.delta });
  }

  if (metrics.outputGuardViolationRate >= THRESHOLDS.outputGuardViolationRate.critical) {
    alerts.push({ severity: 'critical', metric: 'output_guard', message: `Output guard blocking ${metrics.outputGuardViolationRate.toFixed(1)}% of messages`, threshold: THRESHOLDS.outputGuardViolationRate.critical, actual: metrics.outputGuardViolationRate });
  } else if (metrics.outputGuardViolationRate >= THRESHOLDS.outputGuardViolationRate.warning) {
    alerts.push({ severity: 'warning', metric: 'output_guard', message: `Output guard blocking ${metrics.outputGuardViolationRate.toFixed(1)}% of messages`, threshold: THRESHOLDS.outputGuardViolationRate.warning, actual: metrics.outputGuardViolationRate });
  }

  if (metrics.avgResponseTimeMs.current >= THRESHOLDS.avgResponseTimeMs.critical) {
    alerts.push({ severity: 'critical', metric: 'response_time', message: `Average response time ${(metrics.avgResponseTimeMs.current / 1000).toFixed(1)}s`, threshold: THRESHOLDS.avgResponseTimeMs.critical, actual: metrics.avgResponseTimeMs.current });
  } else if (metrics.avgResponseTimeMs.current >= THRESHOLDS.avgResponseTimeMs.warning) {
    alerts.push({ severity: 'warning', metric: 'response_time', message: `Average response time ${(metrics.avgResponseTimeMs.current / 1000).toFixed(1)}s`, threshold: THRESHOLDS.avgResponseTimeMs.warning, actual: metrics.avgResponseTimeMs.current });
  }

  return alerts;
}

/**
 * Run the weekly AI health check.
 * Computes metrics from agentDecisions, compares to prior week, generates alerts.
 */
export async function runAiHealthCheck(): Promise<{
  metrics: HealthMetrics;
  alerts: HealthAlert[];
  reportId: string;
}> {
  const db = getDb();
  const now = new Date();

  const currentEnd = now;
  const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const priorEnd = currentStart;
  const priorStart = new Date(priorEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const current = await computePeriodMetrics(currentStart, currentEnd);
  const prior = await computePeriodMetrics(priorStart, priorEnd);

  const metrics: HealthMetrics = {
    confidenceTrend: {
      current: current.avgConfidence,
      prior: prior.avgConfidence,
      delta: prior.avgConfidence > 0
        ? ((current.avgConfidence - prior.avgConfidence) / prior.avgConfidence) * 100
        : 0,
    },
    escalationRate: {
      current: current.escalationRate,
      prior: prior.escalationRate,
      delta: prior.escalationRate > 0
        ? ((current.escalationRate - prior.escalationRate) / prior.escalationRate) * 100
        : 0,
    },
    outputGuardViolationRate: 0, // TODO: compute from agentDecisions where confidence = 0
    avgResponseTimeMs: {
      current: current.avgResponseTime,
      prior: prior.avgResponseTime,
      delta: prior.avgResponseTime > 0
        ? ((current.avgResponseTime - prior.avgResponseTime) / prior.avgResponseTime) * 100
        : 0,
    },
    qualityTierUsageRate: {
      current: current.qualityTierRate,
      prior: prior.qualityTierRate,
      delta: prior.qualityTierRate > 0
        ? ((current.qualityTierRate - prior.qualityTierRate) / prior.qualityTierRate) * 100
        : 0,
    },
    winBackOptOutRate: 0, // TODO: compute from leads opt-out data
    smartAssistCorrectionRate: 0, // TODO: integrate with smart-assist-learning.ts
    voyageFallbackRate: 0, // TODO: track in embedding service
  };

  const alerts = checkThresholds(metrics);

  const [report] = await db
    .insert(aiHealthReports)
    .values({
      period: 'weekly',
      periodStart: currentStart,
      periodEnd: currentEnd,
      metrics,
      alerts,
    })
    .returning({ id: aiHealthReports.id });

  return { metrics, alerts, reportId: report.id };
}
