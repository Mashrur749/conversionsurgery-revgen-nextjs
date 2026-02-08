import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, teamMembers, dailyStats } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AgencyOverviewStats } from './components/agency-overview-stats';
import { ClientsPerformance } from './components/clients-performance';
import { QuickActions } from './components/quick-actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  // Get all clients
  const allClients = await db
    .select()
    .from(clients)
    .orderBy(clients.createdAt);

  // Get team members count per client
  const teamMemberCounts = await Promise.all(
    allClients.map(async (client) => {
      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.clientId, client.id));
      return { clientId: client.id, count: members.length };
    })
  );

  // Get today's stats for all clients
  const today = new Date().toISOString().split('T')[0];
  const todayStats = await db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.date, today as any));

  // Aggregate stats
  const totalClients = allClients.length;
  const activeClients = allClients.filter((c) => c.status === 'active').length;
  const pendingClients = allClients.filter((c) => c.status === 'pending').length;
  const cancelledClients = allClients.filter((c) => c.status === 'cancelled')
    .length;

  const totalPhoneNumbers = allClients.filter((c) => c.twilioNumber).length;

  const totalTeamMembers = teamMemberCounts.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const todayMessagesSent = todayStats.reduce(
    (sum, stat) => sum + (stat.messagesSent || 0),
    0
  );

  const todayMissedCallsCaptured = todayStats.reduce(
    (sum, stat) => sum + (stat.missedCallsCaptured || 0),
    0
  );

  // Get clients with performance data (with team member counts and phone numbers)
  const clientsWithMetrics = allClients.map((client) => ({
    ...client,
    teamMemberCount: teamMemberCounts.find((tc) => tc.clientId === client.id)
      ?.count || 0,
    hasPhoneNumber: !!client.twilioNumber,
    todayStats: todayStats.find((s) => s.clientId === client.id),
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Agency Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage all your client accounts
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clients/new/wizard">+ New Client</Link>
        </Button>
      </div>

      {/* Overview Stats */}
      <AgencyOverviewStats
        totalClients={totalClients}
        activeClients={activeClients}
        pendingClients={pendingClients}
        cancelledClients={cancelledClients}
        totalPhoneNumbers={totalPhoneNumbers}
        totalTeamMembers={totalTeamMembers}
        todayMessagesSent={todayMessagesSent}
        todayMissedCallsCaptured={todayMissedCallsCaptured}
      />

      {/* Quick Actions */}
      <QuickActions />

      {/* Clients Performance */}
      <ClientsPerformance clients={clientsWithMetrics} />
    </div>
  );
}
