import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, appointments, flowExecutions } from '@/db';
import { clients, subscriptions, knowledgeBase, revenueLeakAudits } from '@/db/schema';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { Phone, CreditCard, CheckCircle, TrendingUp, BookOpen, Shield } from 'lucide-react';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { getCurrentQuarterlyCampaignSummary } from '@/lib/services/campaign-service';
import { getClientLatestReportDelivery } from '@/lib/services/client-report-delivery';
import { SinceLastVisitCard } from './since-last-visit-card';
import { VoiceStatusCard } from './voice-status-card';

export default async function ClientDashboardPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.DASHBOARD);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { clientId } = session;
  const db = getDb();

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
  const { getAgency } = await import('@/lib/services/agency-settings');
  const agencyRow = await getAgency();
  const operatorPhone = agencyRow.operatorPhone ?? null;
  const operatorName = agencyRow.operatorName ?? 'ConversionSurgery Team';

  // Setup status checks + guarantee fields
  const [client] = await db
    .select({ twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const [sub] = await db
    .select({
      id: subscriptions.id,
      guaranteeStatus: subscriptions.guaranteeStatus,
      guaranteeProofEndsAt: subscriptions.guaranteeProofEndsAt,
      guaranteeAdjustedProofEndsAt: subscriptions.guaranteeAdjustedProofEndsAt,
      guaranteeRecoveryEndsAt: subscriptions.guaranteeRecoveryEndsAt,
      guaranteeAdjustedRecoveryEndsAt: subscriptions.guaranteeAdjustedRecoveryEndsAt,
      guaranteeProofQualifiedLeadEngagements: subscriptions.guaranteeProofQualifiedLeadEngagements,
      guaranteeRecoveryAttributedOpportunities: subscriptions.guaranteeRecoveryAttributedOpportunities,
    })
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);
  const hasPhone = !!client?.twilioNumber;
  const hasSubscription = !!sub;
  const needsSetup = !hasPhone || !hasSubscription;

  // Revenue Leak Audit card — only show for first 30 days after signup
  const clientAgeForAuditMs = clientForCost?.createdAt
    ? Date.now() - new Date(clientForCost.createdAt).getTime()
    : Infinity;
  const showAuditCard = clientAgeForAuditMs < 30 * 24 * 60 * 60 * 1000;
  let auditDeliveredAt: Date | null = null;
  if (showAuditCard) {
    const [auditRow] = await db
      .select({ status: revenueLeakAudits.status, deliveredAt: revenueLeakAudits.deliveredAt })
      .from(revenueLeakAudits)
      .where(eq(revenueLeakAudits.clientId, clientId))
      .limit(1);
    if (auditRow?.status === 'delivered' && auditRow.deliveredAt) {
      auditDeliveredAt = auditRow.deliveredAt;
    }
  }

  // Guarantee indicator — only show when actively in proof or recovery window
  const guaranteeStatus = sub?.guaranteeStatus ?? null;
  const showGuaranteeIndicator =
    guaranteeStatus === 'proof_pending' || guaranteeStatus === 'recovery_pending';
  let guaranteeSummary: { label: string; detail: string } | null = null;
  if (showGuaranteeIndicator && sub) {
    const now = new Date();
    if (guaranteeStatus === 'proof_pending') {
      const proofEnd = sub.guaranteeAdjustedProofEndsAt ?? sub.guaranteeProofEndsAt;
      const qleCount = sub.guaranteeProofQualifiedLeadEngagements ?? 0;
      const daysRemaining = proofEnd
        ? Math.max(0, Math.ceil((proofEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 30;
      guaranteeSummary = {
        label: '30-Day Proof',
        detail: `${qleCount}/5 qualified leads \u00b7 ${daysRemaining} days remaining`,
      };
    } else if (guaranteeStatus === 'recovery_pending') {
      const recoveryEnd = sub.guaranteeAdjustedRecoveryEndsAt ?? sub.guaranteeRecoveryEndsAt;
      const daysRemaining = recoveryEnd
        ? Math.max(0, Math.ceil((recoveryEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 90;
      const attributed = sub.guaranteeRecoveryAttributedOpportunities ?? 0;
      const pipelineDollars = Math.round(attributed * 4500);
      guaranteeSummary = {
        label: '90-Day Recovery',
        detail: `$${pipelineDollars.toLocaleString()} pipeline \u00b7 ${daysRemaining} days remaining`,
      };
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-[#F8F9FA] pb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <SinceLastVisitCard clientId={clientId} />

      <VoiceStatusCard />

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

      {/* Revenue Leak Audit — onboarding deliverable, shown for first 30 days */}
      {showAuditCard && (
        <Card className="border-[#6B7E54]/30">
          <CardContent className="py-4">
            <p className="font-medium text-sm text-[#1B2F26] mb-0.5">Revenue Leak Audit</p>
            <p className="text-xs text-muted-foreground mb-2">
              A personalized breakdown of where revenue is falling through in your business.
            </p>
            {auditDeliveredAt ? (
              <p className="text-xs text-[#3D7A50]">
                Delivered on {format(auditDeliveredAt, 'MMMM d, yyyy')} by your account manager.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Being prepared by your account manager &mdash; you&apos;ll receive it within 48 business hours.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Guarantee progress indicator — only when actively in proof or recovery window */}
      {showGuaranteeIndicator && guaranteeSummary && (
        <Link href="/client/billing" className="block">
          <Card className="border-[#6B7E54]/40 bg-[#E3E9E1] hover:bg-[#D8E4DC] transition-colors cursor-pointer">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="h-4 w-4 text-[#3D7A50] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[#1B2F26]">{guaranteeSummary.label}:</span>
                    <span className="text-sm text-muted-foreground ml-1.5">{guaranteeSummary.detail}</span>
                  </div>
                </div>
                <span className="text-xs text-[#6B7E54] shrink-0">Details &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </Link>
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


      {/* Quarterly Growth Blitz — only when a campaign is scheduled/launched/completed (not planned) */}
      {quarterlyCampaign && quarterlyCampaign.status !== 'planned' && (
        <Card className="border-[#6B7E54]/30">
          <CardContent className="flex items-start gap-3 pt-4 pb-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-[#1B2F26]">
                  {quarterlyCampaign.campaignTypeLabel}
                </span>
                <span className="text-xs text-muted-foreground">{quarterlyCampaign.quarterKey}</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#E3E9E1] text-[#1B2F26]">
                  {quarterlyCampaign.statusLabel}
                </span>
              </div>
              {quarterlyCampaign.missingAssetLabels.length > 0 && (
                <p className="text-xs text-[#C15B2E] mt-1">
                  Needed: {quarterlyCampaign.missingAssetLabels.join(', ')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

    </div>
  );
}
