import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, dailyStats, appointments } from '@/db';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getRevenueStats } from '@/lib/services/revenue';
import { DollarSign } from 'lucide-react';

export default async function ClientDashboardPage() {
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

      {/* Revenue Hero */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-green-800">Revenue Recovered</CardTitle>
          <DollarSign className="h-5 w-5 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-900">
            ${(revenueStats.totalWonValue / 100).toLocaleString()}
          </div>
          <p className="text-xs text-green-700">
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
                <Link key={lead.id} href={`/client/conversations/${lead.id}`} className="flex justify-between items-center hover:bg-gray-50 transition-colors rounded-md px-2 py-1 -mx-2">
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
