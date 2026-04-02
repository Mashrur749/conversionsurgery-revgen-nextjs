import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, dailyStats, appointments, flowExecutions, flows } from '@/db';
import { clients, subscriptions, systemSettings, knowledgeBase } from '@/db/schema';
import { eq, and, gte, sql, desc, inArray, ne } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getRevenueStats } from '@/lib/services/revenue';
import { DollarSign, Phone, CreditCard, CheckCircle, TrendingUp, BookOpen } from 'lucide-react';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { getCurrentQuarterlyCampaignSummary } from '@/lib/services/campaign-service';
import { getClientLatestReportDelivery } from '@/lib/services/client-report-delivery';
import { SinceLastVisitCard } from './since-last-visit-card';

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

  // Attributed wins: won jobs + revenue totals
  const wonLeads = await db
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

  const [wonAgg] = await db
    .select({
      totalConfirmedRevenue: sql<number>`COALESCE(SUM(${leads.confirmedRevenue}), 0)`,
      totalWonJobs: sql<number>`COUNT(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      eq(leads.status, 'won')
    ));

  const totalConfirmedRevenueCents = Number(wonAgg?.totalConfirmedRevenue ?? 0);
  const totalWonJobs = Number(wonAgg?.totalWonJobs ?? 0);

  // Total cost: months since client createdAt × $1,000/mo (in cents)
  const [clientForCost] = await db
    .select({ createdAt: clients.createdAt })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  let totalCostCents = 0;
  if (clientForCost?.createdAt) {
    const diffMs = Date.now() - new Date(clientForCost.createdAt).getTime();
    const months = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
    totalCostCents = months * 100000; // $1,000/mo in cents
  }

  const netReturnCents = totalConfirmedRevenueCents - totalCostCents;
  const quarterlyCampaign = quarterlyCampaignResult.status === 'fulfilled'
    ? quarterlyCampaignResult.value
    : (() => { console.error('[ClientDashboard] Failed to load quarterly campaign:', quarterlyCampaignResult.reason); return null; })();
  const latestReportDelivery = latestReportDeliveryResult.status === 'fulfilled'
    ? latestReportDeliveryResult.value
    : (() => { console.error('[ClientDashboard] Failed to load report delivery:', latestReportDeliveryResult.reason); return null; })();

  // Operator contact info for Account Manager card
  const operatorRows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(inArray(systemSettings.key, ['operator_phone', 'operator_name']));
  const operatorPhone = operatorRows.find((r) => r.key === 'operator_phone')?.value ?? null;
  const operatorName = operatorRows.find((r) => r.key === 'operator_name')?.value ?? 'ConversionSurgery Team';

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

  // KB count — show AI setup card when KB is sparse
  const [kbCountRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(knowledgeBase)
    .where(and(eq(knowledgeBase.clientId, clientId), eq(knowledgeBase.isActive, true)));
  const kbCount = Number(kbCountRow?.count ?? 0);

  // Pipeline proof metrics — zero contractor effort required
  const [pipelineProof] = await db
    .select({
      leadsEngaged: sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} != 'new' THEN ${leads.id} END)`,
      reactivatedResponses: sql<number>`COUNT(DISTINCT CASE WHEN ${leads.source} = 'csv_import' AND ${leads.status} NOT IN ('new', 'lost', 'opted_out') THEN ${leads.id} END)`,
      missedCallsCaught: sql<number>`COALESCE((SELECT SUM(ds.missed_calls_captured) FROM daily_stats ds WHERE ds.client_id = ${clientId}), 0)`,
    })
    .from(leads)
    .where(eq(leads.clientId, clientId));

  const [apptCountRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(appointments)
    .where(and(
      eq(appointments.clientId, clientId),
      ne(appointments.status, 'cancelled')
    ));

  const [flowCountRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(flowExecutions)
    .where(and(
      eq(flowExecutions.clientId, clientId),
      eq(flowExecutions.status, 'active')
    ));

  const leadsEngaged = Number(pipelineProof?.leadsEngaged ?? 0);
  const reactivatedResponses = Number(pipelineProof?.reactivatedResponses ?? 0);
  const missedCallsCaught = Number(pipelineProof?.missedCallsCaught ?? 0);
  const appointmentsBookedTotal = Number(apptCountRow?.count ?? 0);
  const estimatesInFollowUp = Number(flowCountRow?.count ?? 0);

  const AVG_PROJECT_VALUE = 40000; // default; in dollars
  const probablePipeline = (appointmentsBookedTotal + reactivatedResponses) * AVG_PROJECT_VALUE;

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
      <div className="sticky top-0 z-10 bg-[#F8F9FA] pb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <SinceLastVisitCard clientId={clientId} />

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

      {/* AI Setup card — show when KB is empty or sparse */}
      {kbCount < 5 && (
        <Card className="border-[#C15B2E]/30 bg-[#FDEAE4]">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <BookOpen className="h-5 w-5 text-[#C15B2E] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium text-[#1B2F26]">Set up your AI</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Answer 12 questions about your business (10 min) so the AI can handle homeowner questions accurately from day one.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0" style={{ backgroundColor: '#C15B2E' }}>
                <Link href="/client/onboarding">Start Setup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Activity — auto-tracked pipeline proof */}
      <Card className="border-[#6B7E54]/30 bg-[#F8F9FA]">
        <CardHeader className="pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-[#1B2F26]">System Activity</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Auto-tracked. No action needed from you.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hero: probable pipeline */}
          <div>
            <div className="text-3xl font-bold text-[#1B2F26]">
              ${probablePipeline.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Probable pipeline &mdash; {appointmentsBookedTotal} {appointmentsBookedTotal === 1 ? 'appointment' : 'appointments'} booked
              {reactivatedResponses > 0 && ` + ${reactivatedResponses} reactivated ${reactivatedResponses === 1 ? 'quote' : 'quotes'}`}
              {' '}&times; ${AVG_PROJECT_VALUE.toLocaleString()} avg project
            </p>
          </div>

          {/* 3x2 stat grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="text-xl font-bold text-[#1B2F26]">{leadsEngaged}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Leads responded to</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="text-xl font-bold text-[#1B2F26]">{estimatesInFollowUp}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Estimates in follow-up</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="text-xl font-bold text-[#1B2F26]">{missedCallsCaught}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Missed calls caught</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="text-xl font-bold text-[#1B2F26]">{reactivatedResponses}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Dead quotes re-engaged</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="text-xl font-bold text-[#1B2F26]">{appointmentsBookedTotal}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Appointments booked</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="text-xl font-bold text-[#1B2F26]">&lt; 5s</div>
              <div className="text-xs text-muted-foreground mt-0.5">Avg first response</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs We Helped Win — GAP-02 */}
      <Card className="border-[#3D7A50]/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold text-[#1B2F26]">Jobs We Helped Win</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Confirmed by you</p>
          </div>
          <TrendingUp className="h-5 w-5 text-[#3D7A50]" />
        </CardHeader>
        <CardContent className="space-y-4">
          {totalWonJobs === 0 ? (
            <div className="py-6 text-center">
              <p className="text-muted-foreground mb-1">No confirmed revenue yet</p>
              <p className="text-sm text-muted-foreground mb-3">
                Mark jobs as Won in Conversations to see confirmed revenue here.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/client/conversations">View Conversations</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Big number */}
              <div>
                <div className="text-3xl font-bold text-[#3D7A50]">
                  ${Math.round(totalConfirmedRevenueCents / 100).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  from {totalWonJobs} {totalWonJobs === 1 ? 'job' : 'jobs'} the system helped win
                </p>
              </div>

              {/* ROI line */}
              <div className={`text-sm font-medium ${netReturnCents >= 0 ? 'text-[#3D7A50]' : 'text-[#C15B2E]'}`}>
                Total service cost: ${Math.round(totalCostCents / 100).toLocaleString()}&nbsp;&bull;&nbsp;
                Net return: {netReturnCents >= 0
                  ? `+$${Math.round(netReturnCents / 100).toLocaleString()}`
                  : `-$${Math.round(Math.abs(netReturnCents) / 100).toLocaleString()}`}
              </div>

              {/* Recent wins list */}
              {wonLeads.length > 0 && (
                <div className="divide-y">
                  {wonLeads.slice(0, 5).map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/client/conversations/${lead.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-[#F8F9FA] transition-colors rounded-md px-2 -mx-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{lead.name || 'Unknown'}</p>
                        {lead.projectType && (
                          <p className="text-xs text-muted-foreground">{lead.projectType}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {lead.confirmedRevenue != null ? (
                          <p className="text-sm font-medium text-[#3D7A50]">
                            ${Math.round(lead.confirmedRevenue / 100).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Account Manager card — only shown when operator_phone is configured */}
      {operatorPhone && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Your Account Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{operatorName}</p>
            <p className="text-sm text-muted-foreground">{operatorPhone}</p>
            <p className="text-xs text-muted-foreground mt-1">Text or call anytime during business hours</p>
          </CardContent>
        </Card>
      )}

      {/* Revenue Hero */}
      <Card className="bg-[#E8F5E9] border-[#3D7A50]/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-[#3D7A50]">Revenue Recovered</CardTitle>
            <p className="text-xs text-[#3D7A50]/70 mt-0.5">Confirmed by you</p>
          </div>
          <DollarSign className="h-5 w-5 text-[#3D7A50]" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#3D7A50]">
            ${(revenueStats.totalWonValue / 100).toLocaleString()}
          </div>
          <p className="text-xs text-[#3D7A50]">
            ${(revenueStats.totalPaid / 100).toLocaleString()} collected &bull; {revenueStats.totalWon} jobs won
          </p>
          {revenueStats.totalWon === 0 && (
            <p className="text-xs text-[#3D7A50]/70 mt-2">
              Mark jobs as Won in Conversations to see confirmed revenue here.
            </p>
          )}
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
