import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients, leads, appointments, dailyStats } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, gte, sql, count as countFn } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { CheckCircle, Phone, FileText, BookOpen } from 'lucide-react';
import { EditClientForm } from './edit-client-form';
import { TeamManager } from './team-manager';
import { DeleteButton } from './delete-button';
import { FeatureTogglesCard } from './feature-toggles';
import { FeatureStatusList } from './feature-status';
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
import { KbQuestionnaire } from './kb-questionnaire';
import { AiPreviewPanel } from './ai-preview-panel';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
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

  const { getTeamMembers } = await import('@/lib/services/team-bridge');
  const [membersResult, quarterlyCampaignsResult, dayOneSummaryResult] = await Promise.allSettled([
    getTeamMembers(client.id),
    listClientQuarterlyCampaigns(client.id),
    getDayOneActivationSummary(client.id),
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

  // Fetch ROI metrics in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

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

  // Setup status for onboarding card
  const [leadCount] = await db
    .select({ count: countFn() })
    .from(leads)
    .where(eq(leads.clientId, id));
  const [kbCount] = await db
    .select({ count: countFn() })
    .from(knowledgeBase)
    .where(eq(knowledgeBase.clientId, id));
  const hasPhone = !!client.twilioNumber;
  const hasLeads = Number(leadCount?.count ?? 0) > 0;
  const hasKnowledge = Number(kbCount?.count ?? 0) > 0;
  const setupComplete = hasPhone && hasLeads && hasKnowledge;

  const statusColors: Record<string, string> = {
    active: 'bg-[#E8F5E9] text-[#3D7A50]',
    pending: 'bg-[#FFF3E0] text-sienna',
    paused: 'bg-muted text-foreground',
    cancelled: 'bg-[#FDEAE4] text-sienna',
  };

  const onboardingChecklist = !setupComplete ? (
    <Card className="border-olive/30 bg-moss-light">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Client Onboarding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {hasPhone
              ? <CheckCircle className="h-4 w-4 text-[#3D7A50]" />
              : <Phone className="h-4 w-4 text-muted-foreground" />}
            <span className={hasPhone ? 'line-through text-muted-foreground' : ''}>
              Assign phone number
            </span>
          </div>
          {!hasPhone && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/clients/${client.id}/phone`}>Assign</Link>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {hasLeads
              ? <CheckCircle className="h-4 w-4 text-[#3D7A50]" />
              : <FileText className="h-4 w-4 text-muted-foreground" />}
            <span className={hasLeads ? 'line-through text-muted-foreground' : ''}>
              Import historical quotes
            </span>
          </div>
          {!hasLeads && (
            <Button asChild size="sm" variant="outline">
              <Link href="/leads">Import CSV</Link>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {hasKnowledge
              ? <CheckCircle className="h-4 w-4 text-[#3D7A50]" />
              : <BookOpen className="h-4 w-4 text-muted-foreground" />}
            <span className={hasKnowledge ? 'line-through text-muted-foreground' : ''}>
              Set up knowledge base
            </span>
          </div>
          {!hasKnowledge && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/clients/${client.id}/knowledge`}>Configure</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  ) : null;

  const kbEntryCount = Number(kbCount?.count ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.businessName}</h1>
            <Badge className={statusColors[client.status || 'pending']}>
              {client.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Created {format(new Date(client.createdAt!), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin">&#8592; Back to Clients</Link>
          </Button>
          <Button asChild variant={client.twilioNumber ? 'outline' : 'default'}>
            <Link href={`/admin/clients/${client.id}/phone`}>
              {client.twilioNumber ? 'Manage Number' : 'Assign Number'}
            </Link>
          </Button>
        </div>
      </div>

      <ClientDetailTabs
        teamMemberCount={members.length}
        onboardingChecklist={onboardingChecklist}
        kbQuestionnaire={
          kbEntryCount < 5 ? (
            <KbQuestionnaire clientId={client.id} kbCount={kbEntryCount} />
          ) : null
        }
        roiDashboard={<ROIDashboard metrics={roiMetrics} />}
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
          dayOneSummary ? (
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
        featureStatusList={<FeatureStatusList client={client} />}
        onboardingQualityPanel={
          <OnboardingQualityPanel
            clientId={client.id}
            currentAiMode={(client.aiAgentMode as 'off' | 'assist' | 'autonomous') ?? 'assist'}
          />
        }
        reminderRoutingPanel={<ReminderRoutingPanel clientId={client.id} />}
        aiPreviewPanel={<AiPreviewPanel clientId={client.id} />}
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
              <CardTitle>Phone Number</CardTitle>
            </CardHeader>
            <CardContent>
              {client.twilioNumber ? (
                <div className="space-y-3">
                  <p className="text-2xl font-mono">
                    {formatPhoneNumber(client.twilioNumber)}
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
                    No phone number assigned
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
        actionsCard={
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/clients/${client.id}/revenue`}>
                  Revenue Tracking
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/clients/${client.id}/knowledge`}>
                  Knowledge Base
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/clients/${client.id}/reviews`}>
                  Reputation Monitoring
                </Link>
              </Button>
            </CardContent>
          </Card>
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
