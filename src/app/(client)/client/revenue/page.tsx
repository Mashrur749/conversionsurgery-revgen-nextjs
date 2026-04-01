import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, appointments } from '@/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getRevenueStats, getRevenueByService } from '@/lib/services/revenue';
import { getSpeedToLeadMetrics } from '@/lib/services/speed-to-lead';
import { ROIDashboard } from '@/app/(dashboard)/admin/clients/[id]/roi-dashboard';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default async function ClientRevenuePage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.REVENUE_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

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

  const metrics = {
    totalPipeline: revenueStats.totalQuoteValue + revenueStats.totalWonValue,
    totalWonValue: revenueStats.totalWonValue,
    serviceBreakdown: serviceBreakdown.filter(s => s.leadCount > 0),
    avgResponseTimeSeconds: speedMetrics.avgResponseTimeSeconds,
    previousResponseTimeMinutes: speedMetrics.previousResponseTimeMinutes,
    industryAvgMinutes: speedMetrics.industryAvgMinutes,
    speedMultiplier: speedMetrics.speedMultiplier,
    improvementVsPrevious: speedMetrics.improvementVsPrevious,
    missedCallsCaptured: activityCounts.missedCalls,
    appointmentsBooked: activityCounts.appointments,
    leadsReengaged: 0,
    monthlyInvestment: 0,
    roiMultiplier: 0,
    pipelineChange: 0,
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Revenue' }]} />
      <div>
        <h1 className="text-2xl font-bold">Revenue &amp; Performance</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>
      <ROIDashboard metrics={metrics} />
    </div>
  );
}
