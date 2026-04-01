import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, dailyStats, appointments } from '@/db';
import { clients, subscriptions } from '@/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getRevenueStats } from '@/lib/services/revenue';
import { DollarSign, Phone, CreditCard, CheckCircle } from 'lucide-react';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { getCurrentQuarterlyCampaignSummary } from '@/lib/services/campaign-service';
import { getClientLatestReportDelivery } from '@/lib/services/client-report-delivery';

export default async function ClientDashboardPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.DASHBOARD);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { clientId } = session;
  const db = getDb();

  // This month stats
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const monthStats = await db
    .select({
      leadsCapture: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      appointmentsBooked: sql<number>`COALESCE(SUM(${dailyStats.appointmentsReminded}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, firstOfMonth.toISOString().split('T')[0])
    ));

  const stats = monthStats[0] || {};

  // Revenue stats (last 30 days)
  const revenueStats = await getRevenueStats(clientId);
  const [quarterlyCampaignResult, latestReportDeliveryResult] = await Promise.allSettled([
    getCurrentQuarterlyCampaignSummary(clientId),
    getClientLatestReportDelivery(clientId),
  ]);
  const quarterlyCampaign = quarterlyCampaignResult.status === 'fulfilled'
    ? quarterlyCampaignResult.value
    : (() => { console.error('[ClientDashboard] Failed to load quarterly campaign:', quarterlyCampaignResult.reason); return null; })();
  const latestReportDelivery = latestReportDeliveryResult.status === 'fulfilled'
    ? latestReportDeliveryResult.value
    : (() => { console.error('[ClientDashboard] Failed to load report delivery:', latestReportDeliveryResult.reason); return null; })();

  // Setup status checks
  const [client] = await db
    .select({ twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const [sub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);
  const hasPhone = !!client?.twilioNumber;
  const hasSubscription = !!sub;
  const needsSetup = !hasPhone || !hasSubscription;

  // Recent activity
  const recentLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.clientId, clientId))
    .orderBy(desc(leads.createdAt))
    .limit(5);

  // Pending appointments
  const upcomingAppointments = await db
    .select({
      id: appointments.id,
      date: appointments.appointmentDate,
      time: appointments.appointmentTime,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(appointments)
    .leftJoin(leads, eq(appointments.leadId, leads.id))
    .where(and(
      eq(appointments.clientId, clientId),
      eq(appointments.status, 'scheduled'),
      gte(appointments.appointmentDate, new Date().toISOString().split('T')[0])
    ))
    .orderBy(appointments.appointmentDate)
    .limit(5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {needsSetup && (
        <Card className="border-olive/30 bg-moss-light">
          <CardContent className="py-4">
            <p className="font-medium mb-3">Complete your setup to start capturing leads</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {hasPhone
                    ? <CheckCircle className="h-4 w-4 text-[#3D7A50]" />
                    : <Phone className="h-4 w-4 text-muted-foreground" />}
                  <span className={hasPhone ? 'line-through text-muted-foreground' : ''}>
                    Set up your business phone number
                  </span>
                </div>
                {!hasPhone && (
                  <Button asChild size="sm">
                    <Link href="/client/settings/phone">Set Up Phone</Link>
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {hasSubscription
                    ? <CheckCircle className="h-4 w-4 text-[#3D7A50]" />
                    : <CreditCard className="h-4 w-4 text-muted-foreground" />}
                  <span className={hasSubscription ? 'line-through text-muted-foreground' : ''}>
                    Choose a plan
                  </span>
                </div>
                {!hasSubscription && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/client/billing/upgrade">Choose Plan</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Hero */}
      <Card className="bg-[#E8F5E9] border-[#3D7A50]/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-[#3D7A50]">Revenue Recovered</CardTitle>
          <DollarSign className="h-5 w-5 text-[#3D7A50]" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#3D7A50]">
            ${(revenueStats.totalWonValue / 100).toLocaleString()}
          </div>
          <p className="text-xs text-[#3D7A50]">
            ${(revenueStats.totalPaid / 100).toLocaleString()} collected &bull; {revenueStats.totalWon} jobs won
          </p>
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(stats.leadsCapture) || 0}</div>
            <p className="text-xs text-muted-foreground">{revenueStats.conversionRate}% conversion rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(stats.messagesSent) || 0}</div>
            <p className="text-xs text-muted-foreground">Automated responses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Quarterly Growth Blitz Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!quarterlyCampaign ? (
            <p className="text-sm text-muted-foreground">
              Quarterly campaign is being planned by your account team.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">{quarterlyCampaign.campaignTypeLabel}</p>
              <p className="text-sm text-muted-foreground">
                {quarterlyCampaign.quarterKey} • {quarterlyCampaign.statusLabel}
              </p>
              {quarterlyCampaign.missingAssetLabels.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Waiting on assets: {quarterlyCampaign.missingAssetLabels.join(', ')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Bi-Weekly Report Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!latestReportDelivery ? (
            <p className="text-sm text-muted-foreground">
              Your first bi-weekly report has not been generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">
                {latestReportDelivery.periodStart} to {latestReportDelivery.periodEnd}
              </p>
              <p className="text-sm text-muted-foreground">
                {latestReportDelivery.statusSummary}
              </p>
              {latestReportDelivery.state === 'failed' && (
                <p className="text-xs text-muted-foreground">
                  Last issue:{' '}
                  {latestReportDelivery.lastErrorCode ||
                    latestReportDelivery.lastErrorMessage ||
                    'unknown'}
                </p>
              )}
              {latestReportDelivery.downloadPath && (
                <a
                  href={latestReportDelivery.downloadPath}
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Download Latest Report
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-muted-foreground mb-1">No upcoming appointments</p>
              <p className="text-sm text-muted-foreground">Appointments will be scheduled automatically through lead follow-up sequences.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{apt.leadName || apt.leadPhone}</p>
                    <p className="text-sm text-muted-foreground">
                      {apt.date} at {apt.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-muted-foreground mb-1">No leads yet</p>
              <p className="text-sm text-muted-foreground">Leads will appear here when someone calls or submits a form.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <Link key={lead.id} href={`/client/conversations/${lead.id}`} className="flex justify-between items-center hover:bg-[#F8F9FA] transition-colors rounded-md px-2 py-1 -mx-2">
                  <div>
                    <p className="font-medium">{lead.name || lead.phone}</p>
                    <p className="text-sm text-muted-foreground">{lead.source}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
