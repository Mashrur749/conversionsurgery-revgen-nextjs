# Phase 8c: Team Members UI

## Current State (after Phase 8b)
- Team escalation working
- Claim pages exist
- Incoming SMS uses team notifications

## Goal
Add team members management to settings page.

---

## Step 1: Create Team Members API

**CREATE** `src/app/api/team-members/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = await getClientId();
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.clientId, clientId))
    .orderBy(teamMembers.priority);

  return NextResponse.json({ members });
}

const createSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  role: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const [member] = await db
      .insert(teamMembers)
      .values({
        clientId: data.clientId,
        name: data.name,
        phone: normalizePhoneNumber(data.phone),
        email: data.email || null,
        role: data.role || null,
      })
      .returning();

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

---

## Step 2: Create Team Members PATCH/DELETE API

**CREATE** `src/app/api/team-members/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const [updated] = await db
      .update(teamMembers)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(teamMembers.id, params.id))
      .returning();

    return NextResponse.json({ member: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, params.id));

  return NextResponse.json({ success: true });
}
```

---

## Step 3: Create Team Members List Component

**CREATE** `src/app/(dashboard)/settings/team-members-list.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string | null;
  receiveEscalations: boolean | null;
  isActive: boolean | null;
}

export function TeamMembersList({ clientId }: { clientId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', phone: '', email: '', role: '' });

  useEffect(() => {
    fetchMembers();
  }, [clientId]);

  async function fetchMembers() {
    const res = await fetch(`/api/team-members?clientId=${clientId}`);
    const data = await res.json();
    setMembers(data.members || []);
    setLoading(false);
  }

  async function addMember() {
    const res = await fetch('/api/team-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMember, clientId }),
    });

    if (res.ok) {
      setNewMember({ name: '', phone: '', email: '', role: '' });
      setShowAdd(false);
      fetchMembers();
    }
  }

  async function toggleMember(id: string, isActive: boolean) {
    await fetch(`/api/team-members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchMembers();
  }

  async function deleteMember(id: string) {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/team-members/${id}`, { method: 'DELETE' });
    fetchMembers();
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {members.length === 0 && !showAdd ? (
        <p className="text-muted-foreground text-sm">
          No team members yet. Add team members to receive escalation notifications.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">
                  {member.phone} {member.email && `• ${member.email}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {member.role && <Badge variant="outline">{member.role}</Badge>}
                <Badge variant={member.isActive ? 'default' : 'secondary'}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMember(member.id, member.isActive || false)}
                >
                  {member.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => deleteMember(member.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-3 p-4 border rounded-lg">
          <Input
            placeholder="Name"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
          />
          <Input
            placeholder="Phone (e.g., 403-555-1234)"
            value={newMember.phone}
            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
          />
          <Input
            placeholder="Email (optional)"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
          />
          <Input
            placeholder="Role (e.g., Sales, Estimator)"
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={addMember} disabled={!newMember.name || !newMember.phone}>
              Add Member
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)}>
          + Add Team Member
        </Button>
      )}
    </div>
  );
}
```

---

## Step 4: Update Settings Page

**REPLACE** entire `src/app/(dashboard)/settings/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamMembersList } from './team-members-list';

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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              People who receive escalation notifications when AI can't answer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMembersList clientId={clientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Verify

1. `npm run dev`
2. Go to Settings
3. See "Team Members" section
4. Add a team member with your phone number
5. Text the Twilio number: "How much does it cost?"
6. You should receive SMS with claim link
7. Click link → claim → lead's action_required clears

---

## Phase 8 Complete

Team escalation system working. Proceed to **Phase 9** for hot transfers (optional advanced feature).
