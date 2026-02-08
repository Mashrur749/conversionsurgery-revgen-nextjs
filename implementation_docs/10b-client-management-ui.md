# Phase 10b: Client Management UI

## Current State (after Phase 10a)
- Client CRUD API routes exist
- User management API exists
- No UI to manage clients

## Goal
Add admin pages for client and user management.

---

## Step 1: Install Dialog and Tabs Components

```bash
npx shadcn@latest add dialog tabs
```

---

## Step 2: Update Admin Page with Client Management

**REPLACE** entire `src/app/(dashboard)/admin/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { clients, leads, dailyStats } from '@/lib/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

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
            <Link href="/admin/clients/new">+ New Client</Link>
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
                        {client.ownerName} • {client.email}
                      </p>
                      {!client.twilioNumber && (
                        <p className="text-xs text-amber-600">⚠️ No phone number</p>
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
```

---

## Step 3: Create New Client Page

**CREATE** `src/app/(dashboard)/admin/clients/new/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreateClientForm } from './create-client-form';

export default async function NewClientPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Client</CardTitle>
          <CardDescription>
            Add a new contractor to the system. You can assign a phone number after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 4: Create Client Form Component

**CREATE** `src/app/(dashboard)/admin/clients/new/create-client-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONES = [
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
];

export function CreateClientForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    timezone: 'America/Edmonton',
    googleBusinessUrl: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create client');
        return;
      }

      router.push(`/admin/clients/${data.client.id}`);
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            placeholder="ABC Roofing Ltd."
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerName">Owner Name *</Label>
          <Input
            id="ownerName"
            value={formData.ownerName}
            onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
            placeholder="John Smith"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@abcroofing.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="403-555-1234"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select
          value={formData.timezone}
          onValueChange={(value) => setFormData({ ...formData, timezone: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="googleBusinessUrl">Google Business URL (optional)</Label>
        <Input
          id="googleBusinessUrl"
          type="url"
          value={formData.googleBusinessUrl}
          onChange={(e) => setFormData({ ...formData, googleBusinessUrl: e.target.value })}
          placeholder="https://g.page/abc-roofing"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Client'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

---

## Step 5: Create Client Detail Page

**CREATE** `src/app/(dashboard)/admin/clients/[id]/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clients, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { EditClientForm } from './edit-client-form';
import { format } from 'date-fns';

interface Props {
  params: { id: string };
}

export default async function ClientDetailPage({ params }: Props) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) {
    notFound();
  }

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.clientId, client.id))
    .orderBy(teamMembers.priority);

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
          {!client.twilioNumber && (
            <Button asChild>
              <Link href={`/admin/clients/${client.id}/phone`}>
                Assign Phone Number
              </Link>
            </Button>
          )}
        </div>
      </div>

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
                <div className="space-y-2">
                  <p className="text-2xl font-mono">
                    {formatPhoneNumber(client.twilioNumber)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Webhooks configured automatically
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/clients/${client.id}/phone`}>
                      Change Number
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">
                    No phone number assigned yet
                  </p>
                  <Button asChild>
                    <Link href={`/admin/clients/${client.id}/phone`}>
                      Assign Phone Number
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
        </div>
      </div>
    </div>
  );
}
```

---

## Step 6: Create Edit Client Form Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/edit-client-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONES = [
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  timezone: string | null;
  googleBusinessUrl: string | null;
  notificationEmail: boolean | null;
  notificationSms: boolean | null;
  status: string | null;
  monthlyMessageLimit: number | null;
}

export function EditClientForm({ client }: { client: Client }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    businessName: client.businessName,
    ownerName: client.ownerName,
    email: client.email,
    phone: client.phone,
    timezone: client.timezone || 'America/Edmonton',
    googleBusinessUrl: client.googleBusinessUrl || '',
    notificationEmail: client.notificationEmail ?? true,
    notificationSms: client.notificationSms ?? true,
    status: client.status || 'pending',
    monthlyMessageLimit: client.monthlyMessageLimit || 500,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
          Client updated successfully
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="businessName">Business Name</Label>
        <Input
          id="businessName"
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerName">Owner Name</Label>
        <Input
          id="ownerName"
          value={formData.ownerName}
          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select
            value={formData.timezone}
            onValueChange={(value) => setFormData({ ...formData, timezone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="googleBusinessUrl">Google Business URL</Label>
        <Input
          id="googleBusinessUrl"
          type="url"
          value={formData.googleBusinessUrl}
          onChange={(e) => setFormData({ ...formData, googleBusinessUrl: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyMessageLimit">Monthly Message Limit</Label>
        <Input
          id="monthlyMessageLimit"
          type="number"
          value={formData.monthlyMessageLimit}
          onChange={(e) => setFormData({ ...formData, monthlyMessageLimit: parseInt(e.target.value) })}
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="notificationEmail">Email Notifications</Label>
          <Switch
            id="notificationEmail"
            checked={formData.notificationEmail}
            onCheckedChange={(checked) => setFormData({ ...formData, notificationEmail: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="notificationSms">SMS Notifications</Label>
          <Switch
            id="notificationSms"
            checked={formData.notificationSms}
            onCheckedChange={(checked) => setFormData({ ...formData, notificationSms: checked })}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
```

---

## Step 7: Create Users Management Page

**CREATE** `src/app/(dashboard)/admin/users/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, clients } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { UserActions } from './user-actions';

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      clientName: clients.businessName,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(clients, eq(users.clientId, clients.id))
    .orderBy(desc(users.createdAt));

  const allClients = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user access and permissions</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">← Back to Clients</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {allUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{user.name || 'No name'}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.clientName && (
                    <p className="text-xs text-muted-foreground">
                      → {user.clientName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(user.createdAt!), 'MMM d, yyyy')}
                  </span>
                  {user.isAdmin && (
                    <Badge className="bg-amber-100 text-amber-800">Admin</Badge>
                  )}
                  <UserActions
                    user={user}
                    clients={allClients}
                    currentUserId={session.user.id}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 8: Create User Actions Component

**CREATE** `src/app/(dashboard)/admin/users/user-actions.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface User {
  id: string;
  email: string | null;
  isAdmin: boolean | null;
  clientId: string | null;
}

interface Client {
  id: string;
  businessName: string;
}

interface Props {
  user: User;
  clients: Client[];
  currentUserId: string;
}

export function UserActions({ user, clients, currentUserId }: Props) {
  const router = useRouter();
  const [showAssign, setShowAssign] = useState(false);
  const [selectedClient, setSelectedClient] = useState(user.clientId || '');
  const [loading, setLoading] = useState(false);

  const isCurrentUser = user.id === currentUserId;

  async function toggleAdmin() {
    if (isCurrentUser) return;

    setLoading(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    setLoading(false);
    router.refresh();
  }

  async function assignClient() {
    setLoading(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClient || null }),
    });
    setLoading(false);
    setShowAssign(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowAssign(true)}>
            Assign to Client
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={toggleAdmin}
            disabled={isCurrentUser || loading}
            className={user.isAdmin ? 'text-red-600' : ''}
          >
            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="No client (admin only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No client (admin only)</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={assignClient} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setShowAssign(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## Step 9: Install Dropdown Menu Component

```bash
npx shadcn@latest add dropdown-menu
```

---

## Verify

1. `npm run dev`
2. Visit `/admin` as admin user
3. Click "New Client" → fill form → submit
4. Click on client → edit details → save
5. Visit `/admin/users` → assign user to client
6. Toggle admin status on a user

---

## Next
Proceed to **Phase 11a** for Twilio number provisioning.
