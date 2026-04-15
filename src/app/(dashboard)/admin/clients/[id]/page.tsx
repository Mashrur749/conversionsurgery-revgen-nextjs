import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients, leads, appointments, dailyStats } from '@/db';
import { plans, subscriptions } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { EditClientForm } from './edit-client-form';
import { OnboardingChecklistCard } from './onboarding-checklist-card';
import { TeamManager } from './team-manager';
import { DeleteButton } from './delete-button';
import { FeatureTogglesCard } from './feature-toggles';
import { KnowledgeTabContent } from './knowledge-tab-content';
import { ROIDashboard } from './roi-dashboard';
import { QuarterlyCampaignsCard } from './quarterly-campaigns-card';
import { format } from 'date-fns';
import { getRevenueStats, getRevenueByService } from '@/lib/services/revenue';
import { getSpeedToLeadMetrics } from '@/lib/services/speed-to-lead';
import { listClientQuarterlyCampaigns } from '@/lib/services/campaign-service';
import { toQuarterlyCampaignSummaryDto } from '@/lib/services/quarterly-campaign-summary';
import { getDayOneActivationSummary } from '@/lib/services/day-one-activation';
import { DayOneActivationCard } from './day-one-activation-card';
import { AddonProvenanceCard } from './addon-provenance-card';
import { OnboardingQualityPanel } from './onboarding-quality-panel';
import { ReminderRoutingPanel } from './reminder-routing-panel';
import { ClientDetailTabs } from './client-detail-tabs';
import { EmbedWidgetCard } from './embed-widget-card';
import { CalendarIntegrationCard } from './calendar-integration-card';
import { getClientKnowledge, initializeClientKnowledge } from '@/lib/services/knowledge-base';
import { evaluateOnboardingQualityForClient } from '@/lib/services/onboarding-quality';
import { loadStructuredKnowledge } from '@/lib/services/structured-knowledge';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LeadsNeedingFollowupCard } from './leads-needing-followup-card';
import { SendPaymentLink } from './send-payment-link';
import { DataExportButton } from './data-export-button';
import { DncCard } from './dnc-card';
import { SmartAssistCard } from './smart-assist-card';
import { GuaranteeStatusCard } from './guarantee-status-card';
import { EngagementHealthBadge } from './engagement-health-badge';
import { IntegrationsCard } from './integrations-card';
import { ServiceModelToggle } from './service-model-toggle';
import { OnboardingProgress } from './onboarding-progress';
import { checkEngagementHealth } from '@/lib/services/engagement-health';
import { countQualifiedLeadEngagements } from '@/lib/services/guarantee-v2/metrics';
import { calculateProbablePipelineValueCents } from '@/lib/services/pipeline-value';
import { getSmartAssistCorrectionRate } from '@/lib/services/smart-assist-learning';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function ClientDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    notFound();
  }

  // Load available plans and check for existing subscription (for payment link UI)
  const [availablePlans, existingSubscription] = await Promise.all([
    db.select({ id: plans.id, name: plans.name }).from(plans).where(eq(plans.isActive, true)),
    db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.clientId, id)).limit(1),
  ]);
  const hasSubscription = existingSubscription.length > 0;
  const showPaymentLink = client.serviceModel === 'managed' && !hasSubscription;

  const { getTeamMembers } = await import('@/lib/services/team-bridge');
  const [membersResult, quarterlyCampaignsResult, dayOneSummaryResult, engagementHealthResult, guaranteeSubResult] = await Promise.allSettled([
    getTeamMembers(client.id),
    listClientQuarterlyCampaigns(client.id),
    getDayOneActivationSummary(client.id),
    checkEngagementHealth(client.id),
    db
      .select({
        id: subscriptions.id,
        clientId: subscriptions.clientId,
        guaranteeStatus: subscriptions.guaranteeStatus,
        guaranteeProofStartAt: subscriptions.guaranteeProofStartAt,
        guaranteeProofEndsAt: subscriptions.guaranteeProofEndsAt,
        guaranteeAdjustedProofEndsAt: subscriptions.guaranteeAdjustedProofEndsAt,
        guaranteeRecoveryStartAt: subscriptions.guaranteeRecoveryStartAt,
        guaranteeRecoveryEndsAt: subscriptions.guaranteeRecoveryEndsAt,
        guaranteeAdjustedRecoveryEndsAt: subscriptions.guaranteeAdjustedRecoveryEndsAt,
        guaranteeRecoveryAttributedOpportunities: subscriptions.guaranteeRecoveryAttributedOpportunities,
      })
      .from(subscriptions)
      .where(eq(subscriptions.clientId, client.id))
      .limit(1),
  ]);
  const members = membersResult.status === 'fulfilled'
    ? membersResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load team members for client ${client.id}:`, membersResult.reason); return []; })();
  const quarterlyCampaigns = quarterlyCampaignsResult.status === 'fulfilled'
    ? quarterlyCampaignsResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load quarterly campaigns for client ${client.id}:`, quarterlyCampaignsResult.reason); return []; })();
  const dayOneSummary = dayOneSummaryResult.status === 'fulfilled'
    ? dayOneSummaryResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load day-one summary for client ${client.id}:`, dayOneSummaryResult.reason); return null; })();
  const engagementHealth = engagementHealthResult.status === 'fulfilled'
    ? engagementHealthResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load engagement health for client ${client.id}:`, engagementHealthResult.reason); return null; })();
  const guaranteeSub = guaranteeSubResult.status === 'fulfilled'
    ? (guaranteeSubResult.value[0] ?? null)
    : (() => { console.error(`[AdminClientPage] Failed to load guarantee subscription for client ${client.id}:`, guaranteeSubResult.reason); return null; })();

  // Compute guarantee card props (requires QLE count + pipeline value for active windows)
  type GuaranteePhase =
    | 'proof_pending'
    | 'recovery_pending'
    | 'proof_passed'
    | 'recovery_passed'
    | 'proof_failed_refund_review'
    | 'recovery_failed_refund_review'
    | 'completed';

  interface GuaranteeCardProps {
    phase: GuaranteePhase | null;
    qleCount: number;
    qleTarget: number;
    pipelineValueCents: number;
    pipelineTargetCents: number;
    daysRemaining: number;
    windowEndDate: string | null;
    attributedOpportunities: number;
  }

  let guaranteeCardProps: GuaranteeCardProps | null = null;
  if (guaranteeSub?.guaranteeStatus) {
    const now = new Date();
    const phase = guaranteeSub.guaranteeStatus as GuaranteePhase;
    const isActiveProof = phase === 'proof_pending';
    const isActiveRecovery = phase === 'recovery_pending';
    const needsMetrics = isActiveProof || isActiveRecovery;

    let qleCount = 0;
    let pipelineValueCents = 0;
    let windowEndDate: string | null = null;
    let daysRemaining = 0;

    if (needsMetrics) {
      const proofStart = guaranteeSub.guaranteeProofStartAt ?? guaranteeSub.guaranteeAdjustedProofEndsAt;
      const proofEnd = guaranteeSub.guaranteeAdjustedProofEndsAt ?? guaranteeSub.guaranteeProofEndsAt;
      const recoveryStart = guaranteeSub.guaranteeRecoveryStartAt;
      const recoveryEnd = guaranteeSub.guaranteeAdjustedRecoveryEndsAt ?? guaranteeSub.guaranteeRecoveryEndsAt;

      if (isActiveProof && proofStart && proofEnd) {
        const [qleResult] = await Promise.allSettled([
          countQualifiedLeadEngagements(client.id, proofStart, proofEnd),
        ]);
        if (qleResult.status === 'fulfilled') {
          qleCount = qleResult.value.count;
        }
        windowEndDate = proofEnd.toISOString();
        daysRemaining = Math.max(0, Math.ceil((proofEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      if (isActiveRecovery && recoveryStart && recoveryEnd) {
        const [pipelineResult] = await Promise.allSettled([
          calculateProbablePipelineValueCents(client.id, recoveryStart, recoveryEnd),
        ]);
        if (pipelineResult.status === 'fulfilled') {
          pipelineValueCents = pipelineResult.value;
        }
        windowEndDate = recoveryEnd.toISOString();
        daysRemaining = Math.max(0, Math.ceil((recoveryEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } else {
      // For non-active phases, use the relevant end date for display
      const endDate = guaranteeSub.guaranteeAdjustedRecoveryEndsAt
        ?? guaranteeSub.guaranteeRecoveryEndsAt
        ?? guaranteeSub.guaranteeAdjustedProofEndsAt
        ?? guaranteeSub.guaranteeProofEndsAt;
      if (endDate) {
        windowEndDate = endDate.toISOString();
        daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    guaranteeCardProps = {
      phase,
      qleCount,
      qleTarget: 3,
      pipelineValueCents,
      pipelineTargetCents: 4_000_000, // $40,000 default target
      daysRemaining,
      windowEndDate,
      attributedOpportunities: guaranteeSub.guaranteeRecoveryAttributedOpportunities ?? 0,
    };
  }

  // Fetch ROI metrics in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // Smart Assist correction rate (30 days)
  const [correctionRateSettled] = await Promise.allSettled([
    getSmartAssistCorrectionRate(id, thirtyDaysAgo),
  ]);
  const correctionRate = correctionRateSettled.status === 'fulfilled'
    ? correctionRateSettled.value
    : null;

  const defaultRevenueStats: Awaited<ReturnType<typeof getRevenueStats>> = { period: '', totalLeads: 0, totalQuotes: 0, totalWon: 0, totalLost: 0, totalCompleted: 0, conversionRate: 0, totalQuoteValue: 0, totalWonValue: 0, totalPaid: 0, avgJobValue: 0 };
  const defaultSpeedMetrics: Awaited<ReturnType<typeof getSpeedToLeadMetrics>> = { avgResponseTimeSeconds: 0, medianResponseTimeSeconds: 0, totalLeadsWithResponse: 0, fastestResponseSeconds: 0, slowestResponseSeconds: 0, percentUnder1Min: 0, percentUnder5Min: 0, industryAvgMinutes: 0, previousResponseTimeMinutes: null, speedMultiplier: null, improvementVsPrevious: null };
  const defaultActivityCounts = { missedCalls: 0, appointments: 0, reengaged: 0 };

  const [revenueStatsResult, prevRevenueStatsResult, serviceBreakdownResult, speedMetricsResult, activityCountsResult] = await Promise.allSettled([
    getRevenueStats(id, thirtyDaysAgo),
    getRevenueStats(id, sixtyDaysAgo),
    getRevenueByService(id, thirtyDaysAgo),
    getSpeedToLeadMetrics(id, thirtyDaysAgo),
    // Activity counts
    (async () => {
      const [missedCalls] = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(
          eq(leads.clientId, id),
          eq(leads.source, 'missed_call'),
          gte(leads.createdAt, thirtyDaysAgo)
        ));
      const [appts] = await db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(and(
          eq(appointments.clientId, id),
          gte(appointments.createdAt, thirtyDaysAgo)
        ));
      // Win-back re-engagements: leads that went from dormant back to contacted
      const reengaged = 0; // Will be populated when win-back data exists
      return {
        missedCalls: Number(missedCalls?.count || 0),
        appointments: Number(appts?.count || 0),
        reengaged,
      };
    })(),
  ]);

  const revenueStats = revenueStatsResult.status === 'fulfilled'
    ? revenueStatsResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load revenue stats for client ${id}:`, revenueStatsResult.reason); return defaultRevenueStats; })();
  const prevRevenueStats = prevRevenueStatsResult.status === 'fulfilled'
    ? prevRevenueStatsResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load prev revenue stats for client ${id}:`, prevRevenueStatsResult.reason); return defaultRevenueStats; })();
  const serviceBreakdown = serviceBreakdownResult.status === 'fulfilled'
    ? serviceBreakdownResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load service breakdown for client ${id}:`, serviceBreakdownResult.reason); return []; })();
  const speedMetrics = speedMetricsResult.status === 'fulfilled'
    ? speedMetricsResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load speed metrics for client ${id}:`, speedMetricsResult.reason); return defaultSpeedMetrics; })();
  const activityCounts = activityCountsResult.status === 'fulfilled'
    ? activityCountsResult.value
    : (() => { console.error(`[AdminClientPage] Failed to load activity counts for client ${id}:`, activityCountsResult.reason); return defaultActivityCounts; })();

  // Calculate month-over-month pipeline change
  const prevPipeline = prevRevenueStats.totalWonValue - revenueStats.totalWonValue;
  const pipelineChange = prevPipeline > 0
    ? Math.round(((revenueStats.totalWonValue - prevPipeline) / prevPipeline) * 100)
    : 0;

  const monthlyInvestment = 997;
  const roiMultiplier = revenueStats.totalWonValue > 0
    ? Math.round((revenueStats.totalWonValue / 100) / monthlyInvestment)
    : 0;

  const roiMetrics = {
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
    leadsReengaged: activityCounts.reengaged,
    monthlyInvestment,
    roiMultiplier,
    pipelineChange,
  };

  // Initialize and load knowledge base data
  await initializeClientKnowledge(id);
  const [kbEntries, structuredKnowledge] = await Promise.all([
    getClientKnowledge(id),
    loadStructuredKnowledge(id),
  ]);

  // Load quality gates for OnboardingProgress — only when client is in onboarding window
  const ONBOARDING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const isInOnboardingWindow =
    client.aiAgentMode !== 'autonomous' ||
    Date.now() - new Date(client.createdAt).getTime() < ONBOARDING_WINDOW_MS;

  const onboardingQualityResult = isInOnboardingWindow
    ? await evaluateOnboardingQualityForClient({
        clientId: id,
        source: 'admin_client_detail',
        persistSnapshot: false,
      }).catch((err) => {
        console.error('[AdminClientPage] Failed to load onboarding quality:', err);
        return null;
      })
    : null;

  const onboardingQualityGates = onboardingQualityResult?.gates.map((gate) => ({
    name: gate.title,
    passed: gate.passed,
    details: gate.passed ? undefined : gate.reasons[0],
  })) ?? null;

  const statusColors: Record<string, string> = {
    active: 'bg-[#E8F5E9] text-[#3D7A50]',
    pending: 'bg-[#FFF3E0] text-sienna',
    paused: 'bg-muted text-foreground',
    cancelled: 'bg-[#FDEAE4] text-sienna',
  };

  // Only show onboarding checklist for clients in onboarding phase
  const isInOnboarding = client.status !== 'active' ||
    (Date.now() - new Date(client.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

  const onboardingChecklist = isInOnboarding
    ? <OnboardingChecklistCard clientId={client.id} />
    : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={
        from === 'triage'
          ? [{ label: 'Triage', href: '/admin/triage' }, { label: client.businessName }]
          : [{ label: 'Clients', href: '/admin/clients' }, { label: 'Client Details' }]
      } />
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.businessName}</h1>
            <Badge className={statusColors[client.status || 'pending']}>
              {client.status}
            </Badge>
            <ServiceModelToggle clientId={client.id} initialModel={client.serviceModel} />
          </div>
          <p className="text-muted-foreground">
            Created {format(new Date(client.createdAt!), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={from === 'triage' ? '/admin/triage' : '/admin'}>
              &larr; {from === 'triage' ? 'Back to Triage' : 'Back to Clients'}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${client.id}/call-prep`}>
              Prep for Call
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${client.id}/schedule`}>
              Schedule
            </Link>
          </Button>
          <Button asChild variant={client.twilioNumber ? 'outline' : 'default'}>
            <Link href={`/admin/clients/${client.id}/phone`}>
              {client.twilioNumber ? 'Manage Number' : 'Assign Number'}
            </Link>
          </Button>
          {showPaymentLink && availablePlans.length > 0 && (
            <SendPaymentLink
              clientId={client.id}
              clientName={client.businessName}
              plans={availablePlans}
            />
          )}
          <DataExportButton clientId={client.id} />
        </div>
      </div>

      <ClientDetailTabs
        teamMemberCount={members.length}
        onboardingChecklist={onboardingChecklist}
        onboardingProgressCard={
          isInOnboardingWindow && onboardingQualityGates ? (
            <OnboardingProgress
              clientId={id}
              aiAgentMode={client.aiAgentMode ?? 'off'}
              createdAt={new Date(client.createdAt)}
              qualityGates={onboardingQualityGates}
            />
          ) : null
        }
        roiDashboard={<ROIDashboard metrics={roiMetrics} />}
        leadsNeedingFollowupCard={<LeadsNeedingFollowupCard clientId={id} />}
        usageCard={
          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages this month</span>
                <span className="font-medium">
                  {client.messagesSentThisMonth} / {client.monthlyMessageLimit}
                </span>
              </div>
            </CardContent>
          </Card>
        }
        dayOneActivationCard={
          client.status === 'active' && dayOneSummary && dayOneSummary.progress.completed === dayOneSummary.progress.total
            ? null
            : dayOneSummary ? (
              <DayOneActivationCard
                clientId={client.id}
                initialSummary={dayOneSummary}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Day-One Activation</CardTitle>
                  <CardDescription>
                    Day-One tracker is temporarily unavailable. Retry after refreshing this page.
                  </CardDescription>
                </CardHeader>
              </Card>
            )
        }
        featureToggles={
          <FeatureTogglesCard
            clientId={client.id}
            flags={{
              missedCallSmsEnabled: client.missedCallSmsEnabled,
              aiResponseEnabled: client.aiResponseEnabled,
              aiAgentEnabled: client.aiAgentEnabled,
              aiAgentMode: client.aiAgentMode,
              autoEscalationEnabled: client.autoEscalationEnabled,
              smartAssistEnabled: client.smartAssistEnabled,
              smartAssistDelayMinutes: client.smartAssistDelayMinutes,
              smartAssistManualCategories: client.smartAssistManualCategories as string[] | null,
              voiceEnabled: client.voiceEnabled,
              flowsEnabled: client.flowsEnabled,
              leadScoringEnabled: client.leadScoringEnabled,
              reputationMonitoringEnabled: client.reputationMonitoringEnabled,
              autoReviewResponseEnabled: client.autoReviewResponseEnabled,
              calendarSyncEnabled: client.calendarSyncEnabled,
              hotTransferEnabled: client.hotTransferEnabled,
              paymentLinksEnabled: client.paymentLinksEnabled,
              photoRequestsEnabled: client.photoRequestsEnabled,
              multiLanguageEnabled: client.multiLanguageEnabled,
              preferredLanguage: client.preferredLanguage,
            }}
          />
        }
        knowledgeContent={
          <KnowledgeTabContent
            clientId={client.id}
            entries={kbEntries}
            structuredData={structuredKnowledge}
          />
        }
        onboardingQualityPanel={
          client.aiAgentMode === 'autonomous' ? null : (
            <OnboardingQualityPanel
              clientId={client.id}
              currentAiMode={(client.aiAgentMode as 'off' | 'assist' | 'autonomous') ?? 'assist'}
            />
          )
        }
        reminderRoutingPanel={<ReminderRoutingPanel clientId={client.id} />}
        embedWidgetCard={<EmbedWidgetCard clientId={client.id} />}
        calendarIntegrationCard={<CalendarIntegrationCard clientId={client.id} />}
        clientInfoCard={
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>Edit business details</CardDescription>
            </CardHeader>
            <CardContent>
              <EditClientForm client={client} />
            </CardContent>
          </Card>
        }
        phoneNumberCard={
          <Card>
            <CardHeader>
              <CardTitle>AI Business Line</CardTitle>
            </CardHeader>
            <CardContent>
              {client.twilioNumber ? (
                <div className="space-y-3">
                  <p className="text-2xl font-mono">
                    {formatPhoneNumber(client.twilioNumber)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Leads text and call this number
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-[#E8F5E9] text-[#3D7A50]">Voice</Badge>
                    <Badge variant="outline" className="bg-[#E8F5E9] text-[#3D7A50]">SMS</Badge>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/clients/${client.id}/phone`}>
                      Manage Number
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">
                    No AI business line assigned
                  </p>
                  <Button asChild>
                    <Link href={`/admin/clients/${client.id}/phone`}>
                      Assign Number
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        }
        teamMembersCard={
          <>
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>{members.length} members</CardDescription>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No team members configured
                  </p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex justify-between items-center text-sm">
                        <span>{member.name}</span>
                        <Badge variant={member.isActive ? 'default' : 'secondary'}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <TeamManager clientId={client.id} />
          </>
        }
        addonProvenanceCard={<AddonProvenanceCard clientId={client.id} />}
        dncCard={<DncCard clientId={client.id} />}
        integrationsCard={<IntegrationsCard clientId={client.id} />}
        smartAssistCard={
          <SmartAssistCard
            clientId={client.id}
            correctionRate={correctionRate ?? undefined}
          />
        }
        guaranteeStatusCard={
          guaranteeCardProps ? (
            <GuaranteeStatusCard
              phase={guaranteeCardProps.phase}
              qleCount={guaranteeCardProps.qleCount}
              qleTarget={guaranteeCardProps.qleTarget}
              pipelineValueCents={guaranteeCardProps.pipelineValueCents}
              pipelineTargetCents={guaranteeCardProps.pipelineTargetCents}
              daysRemaining={guaranteeCardProps.daysRemaining}
              windowEndDate={guaranteeCardProps.windowEndDate}
              attributedOpportunities={guaranteeCardProps.attributedOpportunities}
            />
          ) : null
        }
        engagementHealthBadge={
          engagementHealth ? (
            <EngagementHealthBadge
              status={engagementHealth.status}
              signals={{
                daysSinceLastEstimateFlag: engagementHealth.signals.daysSinceLastEstimateFlag,
                daysSinceLastWonLost: engagementHealth.signals.daysSinceLastWonLost,
                openKbGaps: 0,
              }}
              recommendations={engagementHealth.recommendations}
            />
          ) : null
        }
        quarterlyCampaignsCard={
          <QuarterlyCampaignsCard
            clientId={client.id}
            initialCampaigns={quarterlyCampaigns.map(toQuarterlyCampaignSummaryDto)}
          />
        }
        dangerZone={
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <DeleteButton clientId={client.id} clientName={client.businessName} status={client.status} />
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
