import { NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { getDb, leads, appointments } from '@/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getRevenueStats, getRevenueByService } from '@/lib/services/revenue';
import { getSpeedToLeadMetrics } from '@/lib/services/speed-to-lead';

/** GET /api/client/revenue - Client-facing ROI metrics. */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.REVENUE_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { clientId } = session;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const db = getDb();

  const [revenueStats, serviceBreakdown, speedMetrics, activityCounts] = await Promise.all([
    getRevenueStats(clientId, thirtyDaysAgo),
    getRevenueByService(clientId, thirtyDaysAgo),
    getSpeedToLeadMetrics(clientId, thirtyDaysAgo),
    (async () => {
      const [missedCalls] = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(
          eq(leads.clientId, clientId),
          eq(leads.source, 'missed_call'),
          gte(leads.createdAt, thirtyDaysAgo)
        ));
      const [appts] = await db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(and(
          eq(appointments.clientId, clientId),
          gte(appointments.createdAt, thirtyDaysAgo)
        ));
      return {
        missedCalls: Number(missedCalls?.count || 0),
        appointments: Number(appts?.count || 0),
      };
    })(),
  ]);

  return NextResponse.json({
    totalPipeline: revenueStats.totalQuoteValue + revenueStats.totalWonValue,
    totalWonValue: revenueStats.totalWonValue,
    conversionRate: revenueStats.conversionRate,
    serviceBreakdown: serviceBreakdown.filter(s => s.leadCount > 0),
    avgResponseTimeSeconds: speedMetrics.avgResponseTimeSeconds,
    industryAvgMinutes: speedMetrics.industryAvgMinutes,
    speedMultiplier: speedMetrics.speedMultiplier,
    improvementVsPrevious: speedMetrics.improvementVsPrevious,
    missedCallsCaptured: activityCounts.missedCalls,
    appointmentsBooked: activityCounts.appointments,
  });
}
