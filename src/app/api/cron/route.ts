import { NextRequest, NextResponse } from 'next/server';
import { updateMonthlySummaries } from '@/lib/services/usage-tracking';
import { checkAllClientAlerts } from '@/lib/services/usage-alerts';
import { scoreClientLeads } from '@/lib/services/lead-scoring';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';

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
