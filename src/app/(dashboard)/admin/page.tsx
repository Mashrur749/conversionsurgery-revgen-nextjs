import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb, clients, leads, dailyStats } from '@/db';
import { eq, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  const allClients = await db.select().from(clients).orderBy(clients.businessName);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const clientStats = await db
    .select({
      clientId: dailyStats.clientId,
      missedCalls: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
      forms: sql<number>`COALESCE(SUM(${dailyStats.formsResponded}), 0)`,
      messages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(gte(dailyStats.date, sevenDaysAgo.toISOString().split('T')[0]))
    .groupBy(dailyStats.clientId);

  const statsMap = new Map(clientStats.map(s => [s.clientId, s]));

  const actionCounts = await db
    .select({
      clientId: leads.clientId,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(eq(leads.actionRequired, true))
    .groupBy(leads.clientId);

  const actionMap = new Map(actionCounts.map(a => [a.clientId, a.count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Clients</h1>
        <p className="text-muted-foreground">Manage all contractor accounts</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allClients.filter(c => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leads (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientStats.reduce((sum, s) => sum + Number(s.missedCalls) + Number(s.forms), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Sent (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientStats.reduce((sum, s) => sum + Number(s.messages), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Array.from(actionMap.values()).reduce((sum, count) => sum + Number(count), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {allClients.map((client) => {
              const stats = statsMap.get(client.id);
              const actionCount = actionMap.get(client.id) || 0;

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    {actionCount > 0 && (
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <div>
                      <p className="font-medium">{client.businessName}</p>
                      <p className="text-sm text-muted-foreground">
                        {client.ownerName} &bull; {client.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right text-sm">
                      <p className="font-medium">
                        {Number(stats?.missedCalls || 0) + Number(stats?.forms || 0)} leads
                      </p>
                      <p className="text-muted-foreground">
                        {stats?.messages || 0} messages
                      </p>
                    </div>
                    {actionCount > 0 && (
                      <Badge variant="destructive">{actionCount} action</Badge>
                    )}
                    <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
