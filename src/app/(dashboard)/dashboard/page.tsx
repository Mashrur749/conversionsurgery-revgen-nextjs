import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb, leads, dailyStats, scheduledMessages } from '@/db';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const clientId = await getClientId();

  if (session?.user?.isAdmin && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-2">Select a Client</h2>
        <p className="text-muted-foreground">
          Use the dropdown in the header to select a client to view.
        </p>
      </div>
    );
  }

  if (!clientId) {
    return <div>No client linked to account</div>;
  }

  const db = getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const stats = await db
    .select({
      missedCalls: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
      forms: sql<number>`COALESCE(SUM(${dailyStats.formsResponded}), 0)`,
      messages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      appointments: sql<number>`COALESCE(SUM(${dailyStats.appointmentsReminded}), 0)`,
      estimates: sql<number>`COALESCE(SUM(${dailyStats.estimatesFollowedUp}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, sevenDaysAgo.toISOString().split('T')[0])
    ));

  const weekStats = stats[0] || {};

  const actionLeads = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      eq(leads.actionRequired, true)
    ))
    .orderBy(desc(leads.updatedAt))
    .limit(5);

  const pendingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(scheduledMessages)
    .where(and(
      eq(scheduledMessages.clientId, clientId),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Last 7 days overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads Captured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(weekStats.missedCalls || 0) + Number(weekStats.forms || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {weekStats.missedCalls} calls, {weekStats.forms} forms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekStats.messages || 0}</div>
            <p className="text-xs text-muted-foreground">Automated responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(weekStats.estimates || 0) + Number(weekStats.appointments || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {weekStats.estimates} estimates, {weekStats.appointments} appts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount[0]?.count || 0}</div>
            <p className="text-xs text-muted-foreground">Messages pending</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Action Required
            {actionLeads.length > 0 && (
              <Badge variant="destructive">{actionLeads.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionLeads.length === 0 ? (
            <p className="text-muted-foreground text-sm">No actions needed</p>
          ) : (
            <div className="space-y-3">
              {actionLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{lead.name || lead.phone}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.actionRequiredReason}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {formatDistanceToNow(new Date(lead.updatedAt!), { addSuffix: true })}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
