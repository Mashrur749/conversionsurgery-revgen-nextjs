import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, appointments } from '@/db';
import { clients } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getRevenueStats, getRevenueByService } from '@/lib/services/revenue';
import { getSpeedToLeadMetrics } from '@/lib/services/speed-to-lead';
import { ROIDashboard } from '@/app/(dashboard)/admin/clients/[id]/roi-dashboard';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';

export default async function ClientRevenuePage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.REVENUE_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { clientId } = session;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const db = getDb();

  const [revenueStats, serviceBreakdown, speedMetrics, activityCounts, clientRow, wonAgg] = await Promise.all([
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
    db.select({ createdAt: clients.createdAt }).from(clients).where(eq(clients.id, clientId)).limit(1),
    db
      .select({
        totalConfirmedRevenue: sql<number>`COALESCE(SUM(${leads.confirmedRevenue}), 0)`,
        totalWonCount: sql<number>`COUNT(*)`,
      })
      .from(leads)
      .where(and(eq(leads.clientId, clientId), eq(leads.status, 'won'))),
  ]);

  // ROI summary calculations
  const clientCreatedAt = clientRow[0]?.createdAt;
  const diffMs = clientCreatedAt ? Date.now() - new Date(clientCreatedAt).getTime() : 0;
  const months = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
  const totalCostCents = months * 100000; // $1,000/mo in cents
  const totalRevenueCents = Number(wonAgg[0]?.totalConfirmedRevenue ?? 0);
  const totalWonCount = Number(wonAgg[0]?.totalWonCount ?? 0);
  const netReturnCents = totalRevenueCents - totalCostCents;
  const roiMultiplier = totalCostCents > 0 ? totalRevenueCents / totalCostCents : 0;
  const avgJobValueCents = totalWonCount > 0 ? totalRevenueCents / totalWonCount : 0;
  const monthsPerProject = avgJobValueCents > 0 ? Math.round(avgJobValueCents / 100000) : null;

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

  const isPositiveROI = netReturnCents >= 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Revenue' }]} />
      <div>
        <h1 className="text-2xl font-bold">Revenue &amp; Performance</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>

      {/* ROI Summary — all-time, contractor-facing */}
      <Card className={isPositiveROI ? 'border-[#3D7A50]/30 bg-[#E8F5E9]' : 'border-[#C15B2E]/30 bg-[#FDEAE4]'}>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Investment</p>
              <p className="text-xl font-bold text-[#1B2F26] mt-0.5">
                ${Math.round(totalCostCents / 100).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{months} {months === 1 ? 'month' : 'months'} of service</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue Recovered</p>
              <p className={`text-xl font-bold mt-0.5 ${isPositiveROI ? 'text-[#3D7A50]' : 'text-[#1B2F26]'}`}>
                ${Math.round(totalRevenueCents / 100).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{totalWonCount} confirmed {totalWonCount === 1 ? 'job' : 'jobs'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Return</p>
              <p className={`text-xl font-bold mt-0.5 ${isPositiveROI ? 'text-[#3D7A50]' : 'text-[#C15B2E]'}`}>
                {isPositiveROI
                  ? `+$${Math.round(netReturnCents / 100).toLocaleString()}`
                  : `-$${Math.round(Math.abs(netReturnCents) / 100).toLocaleString()}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">ROI</p>
              <p className={`text-xl font-bold mt-0.5 ${isPositiveROI ? 'text-[#3D7A50]' : 'text-[#C15B2E]'}`}>
                {roiMultiplier.toFixed(1)}x
              </p>
              <p className="text-xs text-muted-foreground">return on spend</p>
            </div>
          </div>
          {monthsPerProject !== null && monthsPerProject > 0 && (
            <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-black/5">
              One recovered project pays for {monthsPerProject} {monthsPerProject === 1 ? 'month' : 'months'} of service.
            </p>
          )}
        </CardContent>
      </Card>

      <ROIDashboard metrics={metrics} />
    </div>
  );
}
