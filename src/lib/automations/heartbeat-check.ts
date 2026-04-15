import { getDb } from '@/db';
import { cronJobCursors, auditLog } from '@/db/schema';
import { checkRateAnomaly } from '@/lib/services/ops-health-monitor';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * Formats a timestamp as a human-readable "time ago" string.
 */
function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffHours >= 48) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
  if (diffHours >= 1) {
    return `${diffHours}h ago`;
  }
  return `${diffMins}m ago`;
}

/**
 * Daily meta-cron: verifies all expected cron jobs fired in the last 24 hours.
 *
 * Checks:
 * 1. All cronJobCursors rows — lastRunAt must be within 26h (buffer for timing drift)
 * 2. Any cursor with status = 'failed' is flagged
 * 3. Rate anomaly check via ops-health-monitor
 * 4. Writes an audit_log entry if any issues are found
 */
export async function runHeartbeatCheck(): Promise<{ healthy: boolean; issues: string[] }> {
  const db = getDb();
  const issues: string[] = [];
  const windowMs = 26 * 60 * 60 * 1000; // 26-hour window with timing drift buffer
  const cutoff = new Date(Date.now() - windowMs);

  // Record that the heartbeat itself is running — makes staleness detectable by external monitors
  await db
    .insert(cronJobCursors)
    .values({
      jobKey: 'heartbeat_check',
      periodType: 'daily',
      lastRunAt: new Date(),
      status: 'running',
    })
    .onConflictDoUpdate({
      target: cronJobCursors.jobKey,
      set: { lastRunAt: new Date(), status: 'running', updatedAt: new Date() },
    });

  try {
    // Step 1: Query all cron job cursors
    const cursors = await db.select().from(cronJobCursors);

    // Steps 2-4: Check each job
    for (const cursor of cursors) {
      // Check if lastRunAt is null or older than 26h
      if (!cursor.lastRunAt || cursor.lastRunAt < cutoff) {
        const timeAgo = cursor.lastRunAt ? formatTimeAgo(cursor.lastRunAt) : 'never';
        issues.push(`${cursor.jobKey}: last run ${timeAgo}`);
      }

      // Check for failed status
      if (cursor.status === 'failed') {
        const errDetail = cursor.lastErrorMessage ?? 'no error message';
        issues.push(`${cursor.jobKey}: status failed (${errDetail})`);
      }
    }

    // Step 5: Check rate anomaly
    const rateAnomaly = await checkRateAnomaly();

    // Step 6: If rate anomaly, add to issues
    if (rateAnomaly.anomaly && rateAnomaly.detail) {
      issues.push(`rate_anomaly: ${rateAnomaly.detail}`);
    }

    // Step 7: If any issues, write audit log entry
    if (issues.length > 0) {
      try {
        await db.insert(auditLog).values({
          action: 'heartbeat_check_alert',
          metadata: { issues } as Record<string, unknown>,
        });
      } catch (auditErr) {
        logSanitizedConsoleError('[HeartbeatCheck] Failed to write audit log:', auditErr);
      }
    }
  } catch (err) {
    logSanitizedConsoleError('[HeartbeatCheck] Error running heartbeat check:', err);
    issues.push(`heartbeat_check: internal error - ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Update cursor to completed (best-effort — don't let this fail the health result)
  try {
    await db
      .insert(cronJobCursors)
      .values({
        jobKey: 'heartbeat_check',
        periodType: 'daily',
        lastRunAt: new Date(),
        lastSuccessAt: issues.length === 0 ? new Date() : undefined,
        status: 'completed',
      })
      .onConflictDoUpdate({
        target: cronJobCursors.jobKey,
        set: {
          lastSuccessAt: issues.length === 0 ? new Date() : undefined,
          status: 'completed',
          updatedAt: new Date(),
        },
      });
  } catch (cursorErr) {
    logSanitizedConsoleError('[HeartbeatCheck] Failed to update cursor status:', cursorErr);
  }

  // Step 8: Return result
  return { healthy: issues.length === 0, issues };
}
