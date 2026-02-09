import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, dailyStats, appointments } from '@/db';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

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
      {/* Value Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{Number(stats.leadsCapture) || 0}</div>
            <p className="text-sm text-muted-foreground">Leads This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{Number(stats.messagesSent) || 0}</div>
            <p className="text-sm text-muted-foreground">Messages Sent</p>
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
            <p className="text-sm text-muted-foreground">No upcoming appointments</p>
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
            <p className="text-sm text-muted-foreground">No leads yet</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{lead.name || lead.phone}</p>
                    <p className="text-sm text-muted-foreground">{lead.source}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
