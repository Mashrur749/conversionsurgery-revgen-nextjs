import { getDb } from '@/db';
import { agentDecisions, auditLog } from '@/db/schema';
import { and, gte, eq, count, avg } from 'drizzle-orm';
import { alertOperator } from '@/lib/services/operator-alerts';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const CONFIDENCE_THRESHOLD = 40;
const MIN_DECISIONS_FOR_ALERT = 5;
const OUTPUT_GUARD_BLOCK_THRESHOLD = 3;
const LOOKBACK_HOURS = 1;
const DEDUP_KEY = 'ai_quality_degradation';

/**
 * Hourly check: detects AI quality degradation and alerts the operator.
 *
 * Triggers when EITHER:
 * 1. Average confidence across 5+ decisions in the last hour drops below 40
 * 2. Output guard blocked 3+ messages in the last hour
 *
 * Deduplicates: only sends one alert per hour (checks audit_log).
 */
export async function checkAiQualityDegradation(): Promise<{
  checked: boolean;
  alerted: boolean;
  reason?: string;
}> {
  const db = getDb();
  const lookback = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  try {
    // Check 1: Recent decision confidence
    const [confidenceRow] = await db
      .select({
        avgConfidence: avg(agentDecisions.confidence),
        decisionCount: count(agentDecisions.id),
      })
      .from(agentDecisions)
      .where(gte(agentDecisions.createdAt, lookback));

    const avgConfidence = confidenceRow?.avgConfidence ? Number(confidenceRow.avgConfidence) : null;
    const decisionCount = Number(confidenceRow?.decisionCount ?? 0);

    // Check 2: Output guard blocks (logged in audit_log as 'output_guard_blocked')
    const [blockRow] = await db
      .select({ blockCount: count(auditLog.id) })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, 'output_guard_blocked'),
          gte(auditLog.createdAt, lookback)
        )
      );

    const blockCount = Number(blockRow?.blockCount ?? 0);

    // Evaluate thresholds
    const lowConfidence =
      avgConfidence !== null &&
      decisionCount >= MIN_DECISIONS_FOR_ALERT &&
      avgConfidence < CONFIDENCE_THRESHOLD;

    const highBlockRate = blockCount >= OUTPUT_GUARD_BLOCK_THRESHOLD;

    if (!lowConfidence && !highBlockRate) {
      return { checked: true, alerted: false };
    }

    // Dedup: check if we already alerted in the last hour
    const [recentAlert] = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, DEDUP_KEY),
          gte(auditLog.createdAt, lookback)
        )
      )
      .limit(1);

    if (recentAlert) {
      return { checked: true, alerted: false, reason: 'deduped' };
    }

    // Build alert message
    const reasons: string[] = [];
    if (lowConfidence) {
      reasons.push(
        `Avg AI confidence dropped to ${Math.round(avgConfidence!)} across ${decisionCount} decisions (threshold: ${CONFIDENCE_THRESHOLD})`
      );
    }
    if (highBlockRate) {
      reasons.push(
        `Output guard blocked ${blockCount} messages in the last hour (threshold: ${OUTPUT_GUARD_BLOCK_THRESHOLD})`
      );
    }

    const alertDetail = `${reasons.join('. ')}. Check /admin/ai-effectiveness for details.`;

    // Send operator SMS alert
    await alertOperator('AI Quality Degradation', alertDetail);

    // Log for dedup
    await db.insert(auditLog).values({
      action: DEDUP_KEY,
      metadata: {
        avgConfidence: avgConfidence ? Math.round(avgConfidence) : null,
        decisionCount,
        blockCount,
        reasons,
      } as Record<string, unknown>,
    });

    console.log('[AIQualityAlert] Alert sent:', reasons.join('; '));
    return { checked: true, alerted: true, reason: reasons.join('; ') };
  } catch (err) {
    logSanitizedConsoleError('[AIQualityAlert] Check failed:', err);
    return { checked: false, alerted: false, reason: 'error' };
  }
}
