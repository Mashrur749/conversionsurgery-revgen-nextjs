import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { leads, dailyStats } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getActiveTeamMemberCount } from '@/lib/services/team-bridge';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get lead counts
    const leadCounts = await db
      .select({
        total: sql<number>`count(*)`,
        actionRequired: sql<number>`count(*) filter (where ${leads.actionRequired} = true)`,
      })
      .from(leads)
      .where(eq(leads.clientId, clientId));

    // Get 7-day stats
    const weekStats = await db
      .select({
        missedCalls: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
        forms: sql<number>`COALESCE(SUM(${dailyStats.formsResponded}), 0)`,
        messages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, clientId),
          gte(
            dailyStats.date,
            sevenDaysAgo.toISOString().split('T')[0]
          )
        )
      );

    // Get team member count
    const activeTeamCount = await getActiveTeamMemberCount(clientId);

    return NextResponse.json({
      stats: {
        totalLeads: Number(leadCounts[0]?.total || 0),
        actionRequired: Number(leadCounts[0]?.actionRequired || 0),
        leadsThisWeek:
          Number(weekStats[0]?.missedCalls || 0) +
          Number(weekStats[0]?.forms || 0),
        messagesThisWeek: Number(weekStats[0]?.messages || 0),
        teamMembers: activeTeamCount,
      },
    });
  }
);
