import { NextRequest, NextResponse } from 'next/server';
import { updateMonthlySummaries } from '@/lib/services/usage-tracking';
import { checkAllClientAlerts } from '@/lib/services/usage-alerts';
import { scoreClientLeads } from '@/lib/services/lead-scoring';
import { syncAllReviews, checkAndAlertNegativeReviews } from '@/lib/services/review-monitoring';
import { checkSlaBreaches } from '@/lib/services/escalation';
import { runDailyAnalyticsJob } from '@/lib/services/analytics-aggregation';
import { getDb, clients, reviewSources } from '@/db';
import { eq, and, or, isNull, lt } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Get cron identifier from Cloudflare
  const cronId = request.headers.get('cf-cron');

  if (!cronId) {
    return NextResponse.json({ error: 'Not a cron request' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Every 5 minutes - process scheduled messages
    const processResponse = await fetch(`${baseUrl}/api/cron/process-scheduled`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const processResult = await processResponse.json();

    const now = new Date();
    const results: Record<string, unknown> = { scheduled: processResult };

    // Hourly: update usage summaries and check alerts (runs when minutes < 10)
    if (now.getUTCMinutes() < 10) {
      try {
        await updateMonthlySummaries();
        await checkAllClientAlerts();
        results.usageTracking = { success: true };
      } catch (error) {
        console.error('Usage tracking cron error:', error);
        results.usageTracking = { error: 'Failed' };
      }
    }

    // Hourly: check for escalation SLA breaches
    if (now.getUTCMinutes() < 10) {
      try {
        const breachedCount = await checkSlaBreaches();
        console.log(`[Escalation Cron] Found ${breachedCount} SLA breaches`);
        results.escalationSla = { success: true, breached: breachedCount };
      } catch (error) {
        console.error('Escalation SLA check error:', error);
        results.escalationSla = { error: 'Failed' };
      }
    }

    // Hourly: sync reviews and alert on negative reviews
    if (now.getUTCMinutes() < 10) {
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
            console.error(`Error syncing reviews for client ${clientId}:`, err);
          }
        }

        console.log(`[Review Cron] Synced ${synced} clients, sent ${alerts} alerts`);
        results.reviewSync = { success: true, synced, alerts };
      } catch (error) {
        console.error('Review sync cron error:', error);
        results.reviewSync = { error: 'Failed' };
      }
    }

    // Daily at midnight UTC: rescore all leads (quick mode, no AI)
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 10) {
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
        console.log(`Rescored ${totalScored} leads for ${activeClients.length} clients`);
        results.leadScoring = { success: true, clients: activeClients.length, leadsScored: totalScored };
      } catch (error) {
        console.error('Lead scoring cron error:', error);
        results.leadScoring = { error: 'Failed' };
      }
    }

    // Daily at midnight UTC: run analytics aggregation
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 10) {
      try {
        await runDailyAnalyticsJob();
        console.log('[Analytics Cron] Daily analytics job completed');
        results.analytics = { success: true };
      } catch (error) {
        console.error('Analytics cron error:', error);
        results.analytics = { error: 'Failed' };
      }
    }

    // Check if this is Monday 7am UTC for weekly summary
    if (now.getUTCDay() === 1 && now.getUTCHours() === 7 && now.getUTCMinutes() < 10) {
      const summaryResponse = await fetch(`${baseUrl}/api/cron/weekly-summary`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      results.weeklySummary = await summaryResponse.json();
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Cron handler error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
