import { NextRequest, NextResponse } from 'next/server';
import { getDb, clients, dailyStats } from '@/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { subDays, format, startOfWeek, endOfWeek } from 'date-fns';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get last week's date range
    const now = new Date();
    const weekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
    
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    const db = getDb();

    // Get all active clients
    const activeClients = await db
      .select()
      .from(clients)
      .where(eq(clients.status, 'active'));

    let emailsSent = 0;

    for (const client of activeClients) {
      // Skip if notifications disabled
      if (!client.notificationEmail) continue;

      // Aggregate stats for the week
      const stats = await db
        .select({
          missedCallsCaptured: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
          formsResponded: sql<number>`COALESCE(SUM(${dailyStats.formsResponded}), 0)`,
          appointmentsReminded: sql<number>`COALESCE(SUM(${dailyStats.appointmentsReminded}), 0)`,
          estimatesFollowedUp: sql<number>`COALESCE(SUM(${dailyStats.estimatesFollowedUp}), 0)`,
          reviewsRequested: sql<number>`COALESCE(SUM(${dailyStats.reviewsRequested}), 0)`,
          paymentsReminded: sql<number>`COALESCE(SUM(${dailyStats.paymentsReminded}), 0)`,
          messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
        })
        .from(dailyStats)
        .where(and(
          eq(dailyStats.clientId, client.id),
          gte(dailyStats.date, weekStartStr),
          lte(dailyStats.date, weekEndStr)
        ));

      const weekStats = stats[0] || {};

      // Skip if no activity
      const totalActivity = 
        Number(weekStats.missedCallsCaptured || 0) +
        Number(weekStats.formsResponded || 0) +
        Number(weekStats.messagesSent || 0);

      if (totalActivity === 0) continue;

      // TODO: Send summary email via Resend when email service is configured
      // const emailData = weeklySummaryEmail({
      //   businessName: client.businessName,
      //   weekStart: format(weekStart, 'MMM d'),
      //   weekEnd: format(weekEnd, 'MMM d, yyyy'),
      //   stats: {
      //     missedCallsCaptured: Number(weekStats.missedCallsCaptured || 0),
      //     formsResponded: Number(weekStats.formsResponded || 0),
      //     appointmentsReminded: Number(weekStats.appointmentsReminded || 0),
      //     estimatesFollowedUp: Number(weekStats.estimatesFollowedUp || 0),
      //     reviewsRequested: Number(weekStats.reviewsRequested || 0),
      //     paymentsReminded: Number(weekStats.paymentsReminded || 0),
      //     totalMessages: Number(weekStats.messagesSent || 0),
      //   },
      //   dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      // });

      // For now, just count the clients that would receive emails
      emailsSent++;
    }

    return NextResponse.json({
      success: true,
      clientsChecked: activeClients.length,
      emailsSent,
      weekRange: `${weekStartStr} to ${weekEndStr}`,
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
