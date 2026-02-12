import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads, dailyStats, teamMembers } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  const clientId = id;
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
  const teamCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.clientId, clientId),
        eq(teamMembers.isActive, true)
      )
    );

  return NextResponse.json({
    stats: {
      totalLeads: Number(leadCounts[0]?.total || 0),
      actionRequired: Number(leadCounts[0]?.actionRequired || 0),
      leadsThisWeek:
        Number(weekStats[0]?.missedCalls || 0) +
        Number(weekStats[0]?.forms || 0),
      messagesThisWeek: Number(weekStats[0]?.messages || 0),
      teamMembers: Number(teamCount[0]?.count || 0),
    },
  });
}
