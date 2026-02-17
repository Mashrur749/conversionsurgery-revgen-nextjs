import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients, teamMembers, leads, appointments, dailyStats } from '@/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { EditClientForm } from './edit-client-form';
import { TeamManager } from './team-manager';
import { DeleteButton } from './delete-button';
import { FeatureTogglesCard } from './feature-toggles';
import { FeatureStatusList } from './feature-status';
import { ROIDashboard } from './roi-dashboard';
import { format } from 'date-fns';
import { getRevenueStats, getRevenueByService } from '@/lib/services/revenue';
import { getSpeedToLeadMetrics } from '@/lib/services/speed-to-lead';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
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

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.clientId, client.id))
    .orderBy(teamMembers.priority);

  // Fetch ROI metrics in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [revenueStats, prevRevenueStats, serviceBreakdown, speedMetrics, activityCounts] = await Promise.all([
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

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

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
            <Link href="/admin">← Back to Clients</Link>
          </Button>
          <Button asChild variant={client.twilioNumber ? 'outline' : 'default'}>
            <Link href={`/admin/clients/${client.id}/phone`}>
              {client.twilioNumber ? 'Manage Number' : 'Assign Number'}
            </Link>
          </Button>
        </div>
      </div>

      <ROIDashboard metrics={roiMetrics} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Edit business details</CardDescription>
          </CardHeader>
          <CardContent>
            <EditClientForm client={client} />
          </CardContent>
        </Card>

        <div className="space-y-6">
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
                    <Badge variant="outline" className="bg-green-50 text-green-700">Voice</Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700">SMS</Badge>
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

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <DeleteButton clientId={client.id} clientName={client.businessName} status={client.status} />
            </CardContent>
          </Card>
        </div>
      </div>

      <FeatureStatusList client={client} />

      <FeatureTogglesCard
        clientId={client.id}
        flags={{
          missedCallSmsEnabled: client.missedCallSmsEnabled,
          aiResponseEnabled: client.aiResponseEnabled,
          aiAgentEnabled: client.aiAgentEnabled,
          aiAgentMode: client.aiAgentMode,
          autoEscalationEnabled: client.autoEscalationEnabled,
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

      <TeamManager clientId={client.id} />
    </div>
  );
}
