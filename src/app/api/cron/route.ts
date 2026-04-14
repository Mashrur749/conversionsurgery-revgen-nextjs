import { NextRequest, NextResponse } from 'next/server';
import { updateMonthlySummaries } from '@/lib/services/usage-tracking';
import { checkAllClientAlerts } from '@/lib/services/usage-alerts';
import { scoreClientLeads } from '@/lib/services/lead-scoring';
import { syncAllReviews, checkAndAlertNegativeReviews } from '@/lib/services/review-monitoring';
import { checkSlaBreaches } from '@/lib/services/escalation';
import { runDailyAnalyticsJob } from '@/lib/services/analytics-aggregation';
import { updateCohortMetrics } from '@/lib/services/cohort-analysis';
import { getDb, clients, reviewSources } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, or, isNull, lt, sql } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { alertOperator } from '@/lib/services/operator-alerts';
import { runEngagementHealthCheck } from '@/lib/services/engagement-health';
import { runAiHealthCheck } from '@/lib/services/ai-health-check';
import { runDormantReengagement } from '@/lib/automations/dormant-reengagement';
import { processStuckEstimateNudges } from '@/lib/automations/stuck-estimate-nudge';
import { embedKnowledgeEntry } from '@/lib/services/embedding';

async function backfillEmbeddings(): Promise<{ processed: number; failed: number }> {
  const db = getDb();

  const pending = await db
    .select({
      id: knowledgeBase.id,
      title: knowledgeBase.title,
      content: knowledgeBase.content,
    })
    .from(knowledgeBase)
    .where(
      and(
        eq(knowledgeBase.isActive, true),
        or(
          eq(knowledgeBase.embeddingStatus, 'pending'),
          eq(knowledgeBase.embeddingStatus, 'failed')
        )
      )
    )
    .limit(50);

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const embedding = await embedKnowledgeEntry(entry.title, entry.content);
      const vectorStr = `[${embedding.join(',')}]`;
      await db.execute(
        sql`UPDATE knowledge_base SET embedding = ${vectorStr}::vector, embedding_status = 'ready' WHERE id = ${entry.id}`
      );
      processed++;
    } catch (err) {
      logSanitizedConsoleError(`[Cron] Embedding backfill failed for ${entry.id}:`, err);
      await db.update(knowledgeBase)
        .set({ embeddingStatus: 'failed' })
        .where(eq(knowledgeBase.id, entry.id));
      failed++;
    }
  }

  return { processed, failed };
}

// Helper to dispatch a cron sub-endpoint via fetch.
// Appends to failedJobs on non-2xx status or fetch exception so the caller
// can alert the operator after all jobs have run.
async function dispatch(
  baseUrl: string,
  path: string,
  secret: string,
  method: 'GET' | 'POST' = 'GET',
  failedJobs?: string[]
): Promise<unknown> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      logSanitizedConsoleError('[Cron] Sub-job returned non-2xx:', undefined, {
        path,
        method,
        status: res.status,
      });
      failedJobs?.push(path);
    }
    return await res.json();
  } catch (error) {
    logSanitizedConsoleError('[Cron] Failed to dispatch sub-job:', error, { path, method });
    failedJobs?.push(path);
    return { error: 'dispatch failed' };
  }
}

/**
 * POST handler for Cloudflare Cron trigger.
 * Orchestrates ALL cron jobs via time-based dispatch.
 * Cloudflare fires every 5 min and Monday 7am UTC.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const now = new Date();
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const results: Record<string, unknown> = {};
  const failedJobs: string[] = [];

  try {
    // ── Every 5 minutes ──────────────────────────────────────
    results.scheduled = await dispatch(baseUrl, '/api/cron/process-scheduled', cronSecret!, 'GET', failedJobs);
    results.missedCalls = await dispatch(baseUrl, '/api/cron/check-missed-calls', cronSecret!, 'GET', failedJobs);
    results.escalationRenotify = await dispatch(baseUrl, '/api/cron/escalation-renotify', cronSecret!, 'POST', failedJobs);

    // ── Every 30 minutes (minute 0-4 or 30-34) ──────────────
    if (minute < 5 || (minute >= 30 && minute < 35)) {
      results.autoReviewResponse = await dispatch(baseUrl, '/api/cron/auto-review-response', cronSecret!, 'POST', failedJobs);
      results.calendarSync = await dispatch(baseUrl, '/api/cron/calendar-sync', cronSecret!, 'GET', failedJobs);
      results.reportDeliveryRetries = await dispatch(
        baseUrl,
        '/api/cron/report-delivery-retries',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.voiceCallbacks = await dispatch(baseUrl, '/api/cron/voice-callbacks', cronSecret!, 'GET', failedJobs);
    }

    // ── Hourly (minute < 10) ─────────────────────────────────
    if (minute < 10) {
      try {
        await updateMonthlySummaries();
        await checkAllClientAlerts();
        results.usageTracking = { success: true };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Usage tracking error:', error);
        results.usageTracking = { error: 'Failed' };
      }

      try {
        const breachedCount = await checkSlaBreaches();
        results.escalationSla = { success: true, breached: breachedCount };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Escalation SLA check error:', error);
        results.escalationSla = { error: 'Failed' };
      }

      try {
        const db = getDb();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const sourcesToSync = await db
          .select({ clientId: reviewSources.clientId })
          .from(reviewSources)
          .where(
            and(
              eq(reviewSources.isActive, true),
              or(
                isNull(reviewSources.lastFetchedAt),
                lt(reviewSources.lastFetchedAt, oneHourAgo)
              )
            )
          )
          .groupBy(reviewSources.clientId);

        let synced = 0;
        let alerts = 0;

        for (const { clientId } of sourcesToSync) {
          if (!clientId) continue;
          try {
            await syncAllReviews(clientId);
            alerts += await checkAndAlertNegativeReviews(clientId);
            synced++;
          } catch (err) {
            logSanitizedConsoleError('[Cron] Review sync failed for client:', err, { clientId });
          }
        }

        results.reviewSync = { success: true, synced, alerts };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Review sync error:', error);
        results.reviewSync = { error: 'Failed' };
      }

      results.expirePrompts = await dispatch(baseUrl, '/api/cron/expire-prompts', cronSecret!, 'GET', failedJobs);
      results.sendNps = await dispatch(baseUrl, '/api/cron/send-nps', cronSecret!, 'POST', failedJobs);
      results.agentCheck = await dispatch(baseUrl, '/api/cron/agent-check', cronSecret!, 'GET', failedJobs);
      results.queuedCompliance = await dispatch(baseUrl, '/api/cron/process-queued-compliance', cronSecret!, 'GET', failedJobs);
      results.knowledgeGapAlerts = await dispatch(
        baseUrl,
        '/api/cron/knowledge-gap-alerts',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.onboardingSlaCheck = await dispatch(
        baseUrl,
        '/api/cron/onboarding-sla-check',
        cronSecret!,
        'GET',
        failedJobs
      );

      try {
        const embeddingResult = await backfillEmbeddings();
        if (embeddingResult.processed > 0 || embeddingResult.failed > 0) {
          console.log('[Cron] Embedding backfill:', embeddingResult);
        }
        results.embeddingBackfill = { success: true, ...embeddingResult };
      } catch (err) {
        // Voyage API key not configured or service down — skip silently
        console.warn('[Cron] Embedding backfill skipped:', err instanceof Error ? err.message : err);
        results.embeddingBackfill = { skipped: true };
      }
    }

    // ── Daily midnight UTC (hour=0) ──────────────────────────
    if (hour === 0 && minute < 10) {
      try {
        const db = getDb();
        const activeClients = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.status, 'active'));

        let totalScored = 0;
        for (const client of activeClients) {
          const result = await scoreClientLeads(client.id, { useAI: false });
          totalScored += result.updated;
        }
        results.leadScoring = { success: true, clients: activeClients.length, leadsScored: totalScored };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Lead scoring error:', error);
        results.leadScoring = { error: 'Failed' };
      }

      try {
        await runDailyAnalyticsJob();
        results.analytics = { success: true };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Analytics error:', error);
        results.analytics = { error: 'Failed' };
      }

      results.trialReminders = await dispatch(baseUrl, '/api/cron/trial-reminders', cronSecret!, 'POST', failedJobs);
      results.noShowRecovery = await dispatch(baseUrl, '/api/cron/no-show-recovery', cronSecret!, 'GET', failedJobs);
      results.stripeReconciliation = await dispatch(baseUrl, '/api/cron/stripe-reconciliation', cronSecret!, 'GET', failedJobs);
      results.voiceUsageRollup = await dispatch(
        baseUrl,
        '/api/cron/voice-usage-rollup',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.guaranteeCheck = await dispatch(baseUrl, '/api/cron/guarantee-check', cronSecret!, 'GET', failedJobs);
      results.monthlyReset = await dispatch(baseUrl, '/api/cron/monthly-reset', cronSecret!, 'GET', failedJobs);

      // Monthly: update cohort retention (1st of month)
      if (now.getUTCDate() === 1) {
        try {
          const cohortResult = await updateCohortMetrics();
          results.cohortUpdate = { success: true, ...cohortResult };
        } catch (error) {
          logSanitizedConsoleError('[Cron] Cohort analysis error:', error);
          results.cohortUpdate = { error: 'Failed' };
        }

        results.accessReview = await dispatch(baseUrl, '/api/cron/access-review', cronSecret!, 'GET', failedJobs);
      }
    }

    // ── Daily 7am UTC ────────────────────────────────────────
    if (hour === 7 && minute < 10) {
      results.dailySummary = await dispatch(baseUrl, '/api/cron/daily-summary', cronSecret!, 'GET', failedJobs);
      results.biweeklyReports = await dispatch(baseUrl, '/api/cron/biweekly-reports', cronSecret!, 'GET', failedJobs);
      results.day3Checkin = await dispatch(baseUrl, '/api/cron/day3-checkin', cronSecret!, 'GET', failedJobs);
    }

    // ── Daily 10am UTC ───────────────────────────────────────
    if (hour === 10 && minute < 10) {
      results.aiModeProgression = await dispatch(
        baseUrl,
        '/api/cron/ai-mode-progression',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.winBack = await dispatch(baseUrl, '/api/cron/win-back', cronSecret!, 'GET', failedJobs);
      results.estimateFallbackNudges = await dispatch(
        baseUrl,
        '/api/cron/estimate-fallback-nudges',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.quarterlyCampaignPlanner = await dispatch(
        baseUrl,
        '/api/cron/quarterly-campaign-planner',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.quarterlyCampaignAlerts = await dispatch(
        baseUrl,
        '/api/cron/quarterly-campaign-alerts',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.kbEmptyNudge = await dispatch(baseUrl, '/api/cron/kb-empty-nudge', cronSecret!, 'GET', failedJobs);
      results.kbGapNotify = await dispatch(baseUrl, '/api/cron/kb-gap-notify', cronSecret!, 'GET', failedJobs);
    }

    // ── Daily 10am UTC — Auto-detect probable wins ─────────────
    if (hour === 10 && minute < 10) {
      results.probableWinsNudge = await dispatch(
        baseUrl,
        '/api/cron/probable-wins-nudge',
        cronSecret!,
        'GET',
        failedJobs
      );
      results.proactiveQuotePrompt = await dispatch(
        baseUrl,
        '/api/cron/proactive-quote-prompt',
        cronSecret!,
        'GET',
        failedJobs
      );
    }

    // ── Weekly Monday 7am UTC ────────────────────────────────
    if (day === 1 && hour === 7 && minute < 10) {
      results.weeklySummary = await dispatch(baseUrl, '/api/cron/weekly-summary', cronSecret!, 'GET', failedJobs);
      results.weeklyDigest = await dispatch(baseUrl, '/api/cron/weekly-digest', cronSecret!, 'GET', failedJobs);
      results.agencyDigest = await dispatch(baseUrl, '/api/cron/agency-digest', cronSecret!, 'GET', failedJobs);
      results.quarterlyCampaignDigest = await dispatch(
        baseUrl,
        '/api/cron/quarterly-campaign-alerts?mode=weekly',
        cronSecret!,
        'GET',
        failedJobs
      );

      // GAP-03: engagement decay detection — runs weekly on Mondays
      try {
        const engagementSummary = await runEngagementHealthCheck();
        results.engagementHealthCheck = { success: true, ...engagementSummary };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Engagement health check error:', error);
        results.engagementHealthCheck = { error: 'Failed' };
        failedJobs.push('engagement-health-check');
      }

      // Plan 4 Task 11: AI drift detection — runs weekly on Mondays
      try {
        const healthResult = await runAiHealthCheck();
        if (healthResult.alerts.length > 0) {
          const criticals = healthResult.alerts.filter(a => a.severity === 'critical');
          if (criticals.length > 0) {
            console.warn(`[AIHealthCheck] ${criticals.length} critical alerts:`, criticals.map(a => a.message).join('; '));
            const alertMsg = criticals.map(a => a.message).join('; ');
            await alertOperator(
              'AI Health Critical',
              `${criticals.length} critical AI health alert(s): ${alertMsg}`
            ).catch(err => logSanitizedConsoleError('[AIHealthCheck] Operator alert failed:', err));
          }
        }
        results.aiHealthCheck = { job: 'ai-health-check', ...healthResult };
      } catch (err) {
        logSanitizedConsoleError('[Cron] AI health check error:', err);
        results.aiHealthCheck = { error: 'Failed' };
        failedJobs.push('ai-health-check');
      }
    }

    // ── Weekly Wednesday 10am UTC ─────────────────────────────
    if (day === 3 && hour === 10 && minute < 10) {
      // GAP-03: 6-month dormant re-engagement — runs weekly on Wednesdays
      try {
        const dormantResult = await runDormantReengagement();
        results.dormantReengagement = { success: true, ...dormantResult };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Dormant re-engagement error:', error);
        results.dormantReengagement = { error: 'Failed' };
        failedJobs.push('dormant-reengagement');
      }

      // F1: stuck estimate nudge — alerts contractors about estimates > 21 days old
      try {
        const stuckEstimateResult = await processStuckEstimateNudges();
        results.stuckEstimateNudge = { success: true, ...stuckEstimateResult };
      } catch (error) {
        logSanitizedConsoleError('[Cron] Stuck estimate nudge error:', error);
        results.stuckEstimateNudge = { error: 'Failed' };
        failedJobs.push('stuck-estimate-nudge');
      }
    }

    // ── Operator alert on any dispatch failure ────────────────
    if (failedJobs.length > 0) {
      await alertOperator(
        'Cron failure',
        `Failed jobs: ${failedJobs.join(', ')}`
      );
    }

    return NextResponse.json(results);
  } catch (error) {
    return safeErrorResponse('[Cron][orchestrator]', error, 'Cron failed');
  }
}
