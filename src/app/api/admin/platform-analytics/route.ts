import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, platformAnalytics, clients } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();

  try {
    // Get latest platform analytics row
    const [latest] = await db
      .select()
      .from(platformAnalytics)
      .orderBy(desc(platformAnalytics.date))
      .limit(1);

    // Get active client count from clients table as fallback
    const [clientStats] = await db
      .select({
        activeClients: sql<number>`count(*) filter (where ${clients.status} = 'active')`,
        totalClients: sql<number>`count(*)`,
      })
      .from(clients);

    // Calculate churn rate
    const totalActive = latest?.activeClients || Number(clientStats?.activeClients) || 0;
    const churned = latest?.churnedClients || 0;
    const churnRate = totalActive + churned > 0
      ? (churned / (totalActive + churned)) * 100
      : 0;

    return NextResponse.json({
      mrrCents: latest?.mrrCents || 0,
      activeClients: totalActive || Number(clientStats?.activeClients) || 0,
      newClients: latest?.newClients || 0,
      churnedClients: churned,
      totalMessages: latest?.totalMessages || 0,
      totalAiResponses: latest?.totalAiResponses || 0,
      totalEscalations: latest?.totalEscalations || 0,
      totalLeads: latest?.totalLeads || 0,
      totalApiCostsCents: latest?.totalApiCostsCents || 0,
      avgCostPerClientCents: latest?.avgCostPerClientCents || 0,
      avgClientSatisfaction: latest?.avgClientSatisfaction,
      churnRate,
    });
  } catch (error) {
    console.error('[Platform Analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
