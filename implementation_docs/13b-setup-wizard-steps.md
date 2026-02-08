# Phase 13b: Setup Wizard Remaining Steps

## Current State (after Phase 13a)
- Wizard flow and first two steps exist
- Business info and phone number steps complete
- Need team members, business hours, and review steps

## Goal
Complete the setup wizard with remaining steps.

---

## Step 1: Create Team Members Step

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/steps/step-team-members.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { WizardData } from '../setup-wizard';

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTeamMembers({ data, updateData, onNext, onBack }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    phone: '',
    email: '',
    role: '',
  });
  const [error, setError] = useState('');

  function addMember() {
    if (!newMember.name || !newMember.phone) {
      setError('Name and phone are required');
      return;
    }

    updateData({
      teamMembers: [...data.teamMembers, { ...newMember }],
    });

    setNewMember({ name: '', phone: '', email: '', role: '' });
    setShowAdd(false);
    setError('');
  }

  function removeMember(index: number) {
    updateData({
      teamMembers: data.teamMembers.filter((_, i) => i !== index),
    });
  }

  async function handleNext() {
    // Save team members to database if we have any
    if (data.teamMembers.length > 0 && data.clientId) {
      for (const member of data.teamMembers) {
        await fetch('/api/team-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: data.clientId,
            name: member.name,
            phone: member.phone,
            email: member.email || undefined,
            role: member.role || undefined,
          }),
        });
      }
    }

    onNext();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add team members who will receive escalation notifications when AI can't answer a question.
        They'll get SMS alerts with a link to claim and respond to the lead.
      </p>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {data.teamMembers.length > 0 && (
        <div className="border rounded-lg divide-y">
          {data.teamMembers.map((member, index) => (
            <div key={index} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">
                  {member.phone}
                  {member.email && ` • ${member.email}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {member.role && (
                  <Badge variant="outline">{member.role}</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => removeMember(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone *</Label>
              <Input
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                placeholder="403-555-1234"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Input
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                placeholder="Sales, Estimator, etc."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={addMember}>Add Member</Button>
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

      {data.teamMembers.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          ⚠️ Without team members, escalations will only go to the business owner.
          You can add team members later from the settings page.
        </p>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleNext}>
          Next: Business Hours →
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 2: Create Business Hours Step

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/steps/step-business-hours.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { WizardData } from '../setup-wizard';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBusinessHours({ data, updateData, onNext, onBack }: Props) {
  const [error, setError] = useState('');

  function updateHour(dayOfWeek: number, field: string, value: any) {
    const newHours = data.businessHours.map(h =>
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    );
    updateData({ businessHours: newHours });
  }

  async function handleNext() {
    // Save business hours if we have a client
    if (data.clientId) {
      await fetch('/api/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: data.clientId,
          hours: data.businessHours,
        }),
      });
    }

    onNext();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your business hours. During these times, high-intent leads will trigger
        hot transfers where all team phones ring simultaneously.
      </p>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {data.businessHours.map((hour) => (
          <div key={hour.dayOfWeek} className="flex items-center gap-4">
            <div className="w-28">
              <Label>{DAYS[hour.dayOfWeek]}</Label>
            </div>
            <Switch
              checked={hour.isOpen}
              onCheckedChange={(checked) => updateHour(hour.dayOfWeek, 'isOpen', checked)}
            />
            {hour.isOpen ? (
              <>
                <Input
                  type="time"
                  value={hour.openTime}
                  onChange={(e) => updateHour(hour.dayOfWeek, 'openTime', e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={hour.closeTime}
                  onChange={(e) => updateHour(hour.dayOfWeek, 'closeTime', e.target.value)}
                  className="w-32"
                />
              </>
            ) : (
              <span className="text-muted-foreground">Closed</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Outside business hours, leads will still receive AI responses and escalations
        will be queued for the next business day.
      </p>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleNext}>
          Next: Review →
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 3: Create Review Step

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/steps/step-review.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WizardData } from '../setup-wizard';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  data: WizardData;
  onBack: () => void;
  onComplete: () => void;
}

export function StepReview({ data, onBack, onComplete }: Props) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  async function handleActivate() {
    if (!data.clientId) {
      setError('Client not created');
      return;
    }

    setActivating(true);
    setError('');

    try {
      // Activate the client
      const res = await fetch(`/api/admin/clients/${data.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || 'Failed to activate');
        return;
      }

      onComplete();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setActivating(false);
    }
  }

  const openDays = data.businessHours.filter(h => h.isOpen);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review the setup and activate the client when ready.
      </p>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {/* Business Info */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Business Information</h3>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Business Name</span>
            <span className="font-medium">{data.businessName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Owner</span>
            <span>{data.ownerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{data.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span>{data.phone}</span>
          </div>
        </div>
      </div>

      {/* Phone Number */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Twilio Number</h3>
        {data.twilioNumber ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg">
              {formatPhoneNumber(data.twilioNumber)}
            </span>
            <Badge className="bg-green-100 text-green-800">Configured</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">No number assigned</span>
            <Badge variant="outline" className="text-amber-600">Pending</Badge>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Team Members</h3>
        {data.teamMembers.length > 0 ? (
          <div className="space-y-2">
            {data.teamMembers.map((member, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{member.name}</span>
                <span className="text-muted-foreground">{member.phone}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No team members added (escalations go to owner only)
          </p>
        )}
      </div>

      {/* Business Hours */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Business Hours</h3>
        {openDays.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {openDays.map((h) => (
              <Badge key={h.dayOfWeek} variant="outline">
                {DAYS[h.dayOfWeek]} {h.openTime}-{h.closeTime}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No business hours set (hot transfers disabled)
          </p>
        )}
      </div>

      {/* Warnings */}
      {(!data.twilioNumber || data.teamMembers.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2">Before you go live:</h4>
          <ul className="text-sm text-amber-700 space-y-1">
            {!data.twilioNumber && (
              <li>• Assign a phone number to receive calls and texts</li>
            )}
            {data.teamMembers.length === 0 && (
              <li>• Add team members to share escalation load</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          onClick={handleActivate}
          disabled={activating || !data.twilioNumber}
          className="min-w-32"
        >
          {activating ? 'Activating...' : '🚀 Activate Client'}
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 4: Add Wizard Link to New Client Page

**REPLACE** `src/app/(dashboard)/admin/clients/new/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CreateClientForm } from './create-client-form';

export default async function NewClientPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create New Client</h1>
        <Button asChild>
          <Link href="/admin/clients/new/wizard">
            Use Setup Wizard →
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Create</CardTitle>
          <CardDescription>
            Add a new contractor with basic info. You can configure phone number and team later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateClientForm />
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🧙‍♂️</div>
            <div>
              <h3 className="font-medium text-blue-900">Prefer guided setup?</h3>
              <p className="text-sm text-blue-700 mb-3">
                The Setup Wizard walks you through business info, phone number assignment,
                team members, and business hours in one smooth flow.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/clients/new/wizard">
                  Start Setup Wizard
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 5: Update Admin Page Button

**In** `src/app/(dashboard)/admin/page.tsx`, update the "New Client" button:

```typescript
<Button asChild>
  <Link href="/admin/clients/new/wizard">+ New Client</Link>
</Button>
```

---

## Verify

1. `npm run dev`
2. Visit `/admin` → click "New Client"
3. Follow wizard through all 5 steps:
   - Business Info → creates client
   - Phone Number → search and select (or skip)
   - Team Members → add members
   - Business Hours → configure schedule
   - Review → activate
4. Should see completion screen with links
5. Client appears in admin list as "active"

---

## Complete System Flow

```
Admin visits /admin
    ↓
Clicks "New Client"
    ↓
Setup Wizard guides through:
    1. Business Info (creates client record)
    2. Phone Number (purchases/configures Twilio)
    3. Team Members (adds notification recipients)
    4. Business Hours (configures hot transfer schedule)
    5. Review & Activate
    ↓
Client is live and receiving leads!
```

---

## All Phases Complete! 🎉

Full self-contained system:
- **Phases 1-6**: Core system (webhooks, AI, sequences, dashboard)
- **Phases 7a-7c**: Admin system (multi-client management)
- **Phases 8a-8c**: Team escalation (claim system)
- **Phases 9a-9b**: Hot transfers (ring groups)
- **Phases 10a-10b**: Client CRUD (create/edit/manage)
- **Phases 11a-11b**: Twilio provisioning (search/buy/configure numbers)
- **Phases 13a-13b**: Setup wizard (guided onboarding)

Everything can now be done from the UI — no SQL or Twilio console needed after initial deploy.
