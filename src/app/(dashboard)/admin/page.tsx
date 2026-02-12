import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb, clients, leads, dailyStats } from '@/db';
import { eq, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">Manage all contractor accounts</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/users">Manage Users</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/clients/new/wizard">+ New Client</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allClients.length}</div>
            <p className="text-xs text-muted-foreground">
              {allClients.filter(c => c.status === 'active').length} active
            </p>
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
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {allClients.map((client) => {
              const stats = statsMap.get(client.id);
              const actionCount = actionMap.get(client.id) || 0;

              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {actionCount > 0 && (
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <div>
                      <p className="font-medium">{client.businessName}</p>
                      <p className="text-sm text-muted-foreground">
                        {client.ownerName} &bull; {client.email}
                      </p>
                      {!client.twilioNumber && (
                        <p className="text-xs text-amber-600">No phone number</p>
                      )}
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
                      <Badge variant="destructive">{actionCount}</Badge>
                    )}
                    <Badge className={statusColors[client.status || 'pending']}>
                      {client.status}
                    </Badge>
                  </div>
                </Link>
              );
            })}
            {allClients.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No clients yet. Create your first client to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
