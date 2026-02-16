import { NextRequest, NextResponse } from 'next/server';
import { updateMonthlySummaries } from '@/lib/services/usage-tracking';
import { checkAllClientAlerts } from '@/lib/services/usage-alerts';
import { scoreClientLeads } from '@/lib/services/lead-scoring';
import { syncAllReviews, checkAndAlertNegativeReviews } from '@/lib/services/review-monitoring';
import { checkSlaBreaches } from '@/lib/services/escalation';
import { runDailyAnalyticsJob } from '@/lib/services/analytics-aggregation';
import { getDb, clients, reviewSources } from '@/db';
import { eq, and, or, isNull, lt } from 'drizzle-orm';

// Helper to dispatch a cron sub-endpoint via fetch
async function dispatch(
  baseUrl: string,
  path: string,
  secret: string,
  method: 'GET' | 'POST' = 'GET'
): Promise<unknown> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}` },
    });
    return await res.json();
  } catch (error) {
    console.error(`[Cron] Failed to dispatch ${path}:`, error);
    return { error: 'dispatch failed' };
  }
}

/**
 * POST handler for Cloudflare Cron trigger.
 * Orchestrates ALL cron jobs via time-based dispatch.
 * Cloudflare fires every 5 min and Monday 7am UTC.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  const cronId = request.headers.get('cf-cron');
  if (!cronId) {
    return NextResponse.json({ error: 'Not a cron request' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const now = new Date();
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const results: Record<string, unknown> = {};

  try {
    // ── Every 5 minutes ──────────────────────────────────────
    results.scheduled = await dispatch(baseUrl, '/api/cron/process-scheduled', cronSecret!);
    results.missedCalls = await dispatch(baseUrl, '/api/cron/check-missed-calls', cronSecret!);

    // ── Every 30 minutes (minute 0-4 or 30-34) ──────────────
    if (minute < 5 || (minute >= 30 && minute < 35)) {
      results.autoReviewResponse = await dispatch(baseUrl, '/api/cron/auto-review-response', cronSecret!, 'POST');
      results.calendarSync = await dispatch(baseUrl, '/api/cron/calendar-sync', cronSecret!);
    }

    // ── Hourly (minute < 10) ─────────────────────────────────
    if (minute < 10) {
      try {
        await updateMonthlySummaries();
        await checkAllClientAlerts();
        results.usageTracking = { success: true };
      } catch (error) {
        console.error('[Cron] Usage tracking error:', error);
        results.usageTracking = { error: 'Failed' };
      }

      try {
        const breachedCount = await checkSlaBreaches();
        results.escalationSla = { success: true, breached: breachedCount };
      } catch (error) {
        console.error('[Cron] Escalation SLA check error:', error);
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
            console.error(`[Cron] Error syncing reviews for client ${clientId}:`, err);
          }
        }

        results.reviewSync = { success: true, synced, alerts };
      } catch (error) {
        console.error('[Cron] Review sync error:', error);
        results.reviewSync = { error: 'Failed' };
      }

      results.expirePrompts = await dispatch(baseUrl, '/api/cron/expire-prompts', cronSecret!);
      results.sendNps = await dispatch(baseUrl, '/api/cron/send-nps', cronSecret!, 'POST');
      results.agentCheck = await dispatch(baseUrl, '/api/cron/agent-check', cronSecret!);
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
        console.error('[Cron] Lead scoring error:', error);
        results.leadScoring = { error: 'Failed' };
      }

      try {
        await runDailyAnalyticsJob();
        results.analytics = { success: true };
      } catch (error) {
        console.error('[Cron] Analytics error:', error);
        results.analytics = { error: 'Failed' };
      }

      results.trialReminders = await dispatch(baseUrl, '/api/cron/trial-reminders', cronSecret!, 'POST');
      results.noShowRecovery = await dispatch(baseUrl, '/api/cron/no-show-recovery', cronSecret!);
    }

    // ── Daily 7am UTC ────────────────────────────────────────
    if (hour === 7 && minute < 10) {
      results.dailySummary = await dispatch(baseUrl, '/api/cron/daily-summary', cronSecret!);
    }

    // ── Daily 10am UTC ───────────────────────────────────────
    if (hour === 10 && minute < 10) {
      results.winBack = await dispatch(baseUrl, '/api/cron/win-back', cronSecret!);
    }

    // ── Weekly Monday 7am UTC ────────────────────────────────
    if (day === 1 && hour === 7 && minute < 10) {
      results.weeklySummary = await dispatch(baseUrl, '/api/cron/weekly-summary', cronSecret!);
      results.agencyDigest = await dispatch(baseUrl, '/api/cron/agency-digest', cronSecret!);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Cron] Handler error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
