import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb, leads, clients } from '@/db';
import { eq, and, sql, desc } from 'drizzle-orm';

/** GET /api/client/attributed-wins — Running total of won jobs for the client portal dashboard. */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session }) => {
    const { clientId } = session;
    const db = getDb();

    // Aggregate stats for all won leads
    const [aggRow] = await db
      .select({
        totalConfirmedRevenue: sql<number>`COALESCE(SUM(${leads.confirmedRevenue}), 0)`,
        totalWonJobs: sql<number>`COUNT(*)`,
      })
      .from(leads)
      .where(and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'won')
      ));

    // Last 5 won leads for the recent-wins list
    const recentWins = await db
      .select({
        id: leads.id,
        name: leads.name,
        confirmedRevenue: leads.confirmedRevenue,
        updatedAt: leads.updatedAt,
        projectType: leads.projectType,
      })
      .from(leads)
      .where(and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'won')
      ))
      .orderBy(desc(leads.updatedAt))
      .limit(5);

    // Calculate total cost: months subscribed * $1,000 (in cents)
    const [clientRow] = await db
      .select({ createdAt: clients.createdAt })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    let totalCost = 0;
    if (clientRow?.createdAt) {
      const start = new Date(clientRow.createdAt);
      const now = new Date();
      // Months elapsed, rounded up (minimum 1)
      const diffMs = now.getTime() - start.getTime();
      const diffMonths = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
      totalCost = diffMonths * 100000; // cents ($1,000/mo)
    }

    return NextResponse.json({
      totalConfirmedRevenue: Number(aggRow?.totalConfirmedRevenue ?? 0),
      totalWonJobs: Number(aggRow?.totalWonJobs ?? 0),
      totalCost,
      recentWins,
    });
  }
);
