# Phase 7c: Admin Dashboard Updates

## Current State (after Phase 7b)
- Admin context provider exists
- Client selector component exists
- `getClientId()` helper exists

## Goal
Update dashboard layout and pages to support admin view.

---

## Step 1: Update Dashboard Layout

**REPLACE** entire `src/app/(dashboard)/layout.tsx`:

```typescript
import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ClientSelector } from '@/components/admin/client-selector';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/leads', label: 'Leads' },
  { href: '/scheduled', label: 'Scheduled' },
  { href: '/settings', label: 'Settings' },
];

const adminNavItems = [
  { href: '/admin', label: 'All Clients' },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const isAdmin = session.user?.isAdmin || false;

  let allClients: { id: string; businessName: string; ownerName: string }[] = [];
  if (isAdmin) {
    allClients = await db
      .select({
        id: clients.id,
        businessName: clients.businessName,
        ownerName: clients.ownerName,
      })
      .from(clients)
      .where(eq(clients.status, 'active'))
      .orderBy(clients.businessName);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="font-semibold text-lg">
                Revenue Recovery
              </Link>
              <nav className="hidden md:flex gap-1">
                {isAdmin && adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-2 text-sm text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-md transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin ? (
                <ClientSelector clients={allClients} />
              ) : (
                <span className="text-sm text-gray-600">
                  {(session as any).client?.businessName || session.user?.email}
                </span>
              )}
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <Button variant="ghost" size="sm" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

---

## Step 2: Update Dashboard Page

**REPLACE** entire `src/app/(dashboard)/dashboard/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { leads, dailyStats, scheduledMessages } from '@/lib/db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

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
            <p className="text-muted-foreground text-sm">No actions needed 👍</p>
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
```

---

## Step 3: Update Leads Page

**REPLACE** entire `src/app/(dashboard)/leads/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  estimate_sent: 'bg-purple-100 text-purple-800',
  appointment_scheduled: 'bg-indigo-100 text-indigo-800',
  action_required: 'bg-red-100 text-red-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
  opted_out: 'bg-gray-100 text-gray-800',
};

export default async function LeadsPage() {
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
    return <div>No client linked</div>;
  }

  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.clientId, clientId))
    .orderBy(desc(leads.updatedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">{allLeads.length} total leads</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {allLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No leads yet. They'll appear here when someone calls or submits a form.
              </div>
            ) : (
              allLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {lead.actionRequired && (
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <div>
                      <p className="font-medium">
                        {lead.name || formatPhoneNumber(lead.phone)}
                      </p>
                      {lead.name && (
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(lead.phone)}
                        </p>
                      )}
                      {lead.projectType && (
                        <p className="text-sm text-muted-foreground">
                          {lead.projectType}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={statusColors[lead.status || 'new'] || statusColors.new}>
                      {lead.status?.replace(/_/g, ' ') || 'new'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.updatedAt!), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 4: Update Scheduled Page

**REPLACE** entire `src/app/(dashboard)/scheduled/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { scheduledMessages, leads } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

export default async function ScheduledPage() {
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
    return <div>No client linked</div>;
  }

  const pending = await db
    .select({
      id: scheduledMessages.id,
      content: scheduledMessages.content,
      sendAt: scheduledMessages.sendAt,
      sequenceType: scheduledMessages.sequenceType,
      sequenceStep: scheduledMessages.sequenceStep,
      leadId: scheduledMessages.leadId,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(scheduledMessages)
    .leftJoin(leads, eq(scheduledMessages.leadId, leads.id))
    .where(and(
      eq(scheduledMessages.clientId, clientId),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ))
    .orderBy(asc(scheduledMessages.sendAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduled Messages</h1>
        <p className="text-muted-foreground">{pending.length} messages pending</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No scheduled messages. They'll appear here when sequences are started.
              </div>
            ) : (
              pending.map((msg) => (
                <Link
                  key={msg.id}
                  href={`/leads/${msg.leadId}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">
                        {msg.leadName || formatPhoneNumber(msg.leadPhone || '')}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{msg.sequenceType}</Badge>
                        <Badge variant="secondary">Step {msg.sequenceStep}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(msg.sendAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {msg.content}
                  </p>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 5: Update Settings Page

**REPLACE** entire `src/app/(dashboard)/settings/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function SettingsPage() {
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
    return <div>No client linked</div>;
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return <div>Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Business Name</p>
              <p className="font-medium">{client.businessName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner Name</p>
              <p className="font-medium">{client.ownerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{client.phone}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMS Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Twilio Number</p>
              <p className="font-medium font-mono">
                {client.twilioNumber || 'Not configured'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Messages This Month</p>
              <p className="font-medium">
                {client.messagesSentThisMonth} / {client.monthlyMessageLimit}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Google Business URL</p>
              <p className="font-medium truncate">
                {client.googleBusinessUrl || 'Not set'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Email Notifications</span>
              <Badge variant={client.notificationEmail ? 'default' : 'secondary'}>
                {client.notificationEmail ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>SMS Notifications</span>
              <Badge variant={client.notificationSms ? 'default' : 'secondary'}>
                {client.notificationSms ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Webhook</CardTitle>
            <CardDescription>
              POST form submissions to this URL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block p-3 bg-gray-100 rounded text-sm break-all">
              {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/form
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Include <code>clientId</code>, <code>phone</code>, and optionally{' '}
              <code>name</code>, <code>email</code>, <code>message</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 6: Create Admin Overview Page

**CREATE** `src/app/(dashboard)/admin/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { clients, leads, dailyStats } from '@/lib/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

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
                        {client.ownerName} • {client.phone}
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
```

---

## Verify

1. `npm run dev`
2. Login with admin email
3. Should see "Admin" badge + client dropdown
4. Select a client → dashboard shows their data
5. Visit `/admin` → see all clients overview
6. Switch clients → data updates

---

## Phase 7 Complete

Admin system is working. Proceed to **Phase 8a** for team escalation.
