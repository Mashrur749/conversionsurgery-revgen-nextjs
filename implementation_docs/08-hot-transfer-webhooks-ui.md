# Phase 9b: Hot Transfer Webhooks & UI

## Current State (after Phase 9a)
- Business hours and call attempts tables exist
- `isWithinBusinessHours()` service exists
- `initiateRingGroup()` service exists
- `detectHotIntent()` function exists

## Goal
Add Twilio webhooks for ring groups, business hours UI, and update incoming SMS.

---

## Step 1: Install Switch Component

```bash
npx shadcn@latest add switch
```

---

## Step 2: Create Ring Connect Webhook

**CREATE** `src/app/api/webhooks/twilio/ring-connect/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callAttempts, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get('attemptId');
  const leadPhone = url.searchParams.get('leadPhone');

  if (!attemptId) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, there was an error connecting your call.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const [attempt] = await db
    .select()
    .from(callAttempts)
    .where(eq(callAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, there was an error.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, attempt.clientId!),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ))
    .orderBy(teamMembers.priority);

  if (members.length === 0) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, no one is available to take your call right now. We will call you back shortly.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'alice' }, 'Please hold while we connect you.');

  const dial = twiml.dial({
    timeout: 25,
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-result?attemptId=${attemptId}`,
    callerId: leadPhone || undefined,
  });

  for (const member of members) {
    dial.number(
      {
        statusCallbackEvent: ['answered'],
        statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/member-answered?attemptId=${attemptId}&memberId=${member.id}`,
      },
      member.phone
    );
  }

  twiml.say({ voice: 'alice' }, 'Sorry, no one is available right now. We will call you back very shortly.');

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

---

## Step 3: Create Member Answered Webhook

**CREATE** `src/app/api/webhooks/twilio/member-answered/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callAttempts, teamMembers, leads, clients } from '@/lib/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and } from 'drizzle-orm';
import { formatPhoneNumber } from '@/lib/utils/phone';

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get('attemptId');
  const memberId = url.searchParams.get('memberId');

  if (!attemptId || !memberId) {
    return new NextResponse('OK');
  }

  const [attempt] = await db
    .update(callAttempts)
    .set({
      answeredBy: memberId,
      answeredAt: new Date(),
      status: 'answered',
    })
    .where(eq(callAttempts.id, attemptId))
    .returning();

  if (!attempt) {
    return new NextResponse('OK');
  }

  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, memberId))
    .limit(1);

  const otherMembers = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, attempt.clientId!),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ));

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, attempt.leadId!))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, attempt.clientId!))
    .limit(1);

  if (client?.twilioNumber) {
    const leadDisplay = lead?.name || formatPhoneNumber(lead?.phone || '');

    for (const otherMember of otherMembers) {
      if (otherMember.id === memberId) continue;

      await sendSMS(
        otherMember.phone,
        client.twilioNumber,
        `✓ ${member?.name || 'Team member'} answered the call with ${leadDisplay}`
      );
    }
  }

  if (lead) {
    await db
      .update(leads)
      .set({ actionRequired: false, actionRequiredReason: null })
      .where(eq(leads.id, lead.id));
  }

  return new NextResponse('OK');
}
```

---

## Step 4: Create Ring Result Webhook

**CREATE** `src/app/api/webhooks/twilio/ring-result/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callAttempts, clients, leads } from '@/lib/db/schema';
import { handleNoAnswer } from '@/lib/services/ring-group';
import { eq } from 'drizzle-orm';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get('attemptId');

  const formData = await request.formData();
  const dialCallStatus = formData.get('DialCallStatus') as string;

  if (!attemptId) {
    const twiml = new VoiceResponse();
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const [attempt] = await db
    .select()
    .from(callAttempts)
    .where(eq(callAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    const twiml = new VoiceResponse();
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  await db
    .update(callAttempts)
    .set({
      status: dialCallStatus === 'completed' ? 'answered' : 'no-answer',
      endedAt: new Date(),
    })
    .where(eq(callAttempts.id, attemptId));

  if (dialCallStatus !== 'completed' && dialCallStatus !== 'answered') {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, attempt.clientId!))
      .limit(1);

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, attempt.leadId!))
      .limit(1);

    if (client && lead) {
      await handleNoAnswer({
        leadId: lead.id,
        clientId: client.id,
        leadPhone: lead.phone,
        twilioNumber: client.twilioNumber!,
      });
    }
  }

  const twiml = new VoiceResponse();
  twiml.hangup();

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

---

## Step 5: Create Business Hours API

**CREATE** `src/app/api/business-hours/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { db } from '@/lib/db';
import { businessHours } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId') || await getClientId();

  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const hours = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.clientId, clientId))
    .orderBy(businessHours.dayOfWeek);

  return NextResponse.json({ hours });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clientId, hours } = await request.json();

    for (const hour of hours) {
      await db
        .insert(businessHours)
        .values({
          clientId,
          dayOfWeek: hour.dayOfWeek,
          openTime: hour.openTime,
          closeTime: hour.closeTime,
          isOpen: hour.isOpen,
        })
        .onConflictDoUpdate({
          target: [businessHours.clientId, businessHours.dayOfWeek],
          set: {
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            isOpen: hour.isOpen,
          },
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Business hours error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

---

## Step 6: Create Business Hours Editor Component

**CREATE** `src/app/(dashboard)/settings/business-hours-editor.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface BusinessHour {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean | null;
}

export function BusinessHoursEditor({ clientId }: { clientId: string }) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHours();
  }, [clientId]);

  async function fetchHours() {
    const res = await fetch(`/api/business-hours?clientId=${clientId}`);
    const data = await res.json();

    if (data.hours?.length > 0) {
      setHours(data.hours);
    } else {
      setHours(DAYS.map((_, i) => ({
        dayOfWeek: i,
        openTime: '08:00',
        closeTime: '18:00',
        isOpen: i >= 1 && i <= 5,
      })));
    }
    setLoading(false);
  }

  async function saveHours() {
    setSaving(true);
    await fetch('/api/business-hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, hours }),
    });
    setSaving(false);
  }

  function updateHour(dayOfWeek: number, field: string, value: any) {
    setHours(prev =>
      prev.map(h =>
        h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
      )
    );
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {hours.map((hour) => (
        <div key={hour.dayOfWeek} className="flex items-center gap-4">
          <div className="w-24">
            <Label>{DAYS[hour.dayOfWeek]}</Label>
          </div>
          <Switch
            checked={hour.isOpen || false}
            onCheckedChange={(checked) => updateHour(hour.dayOfWeek, 'isOpen', checked)}
          />
          {hour.isOpen && (
            <>
              <Input
                type="time"
                value={hour.openTime || '08:00'}
                onChange={(e) => updateHour(hour.dayOfWeek, 'openTime', e.target.value)}
                className="w-32"
              />
              <span>to</span>
              <Input
                type="time"
                value={hour.closeTime || '18:00'}
                onChange={(e) => updateHour(hour.dayOfWeek, 'closeTime', e.target.value)}
                className="w-32"
              />
            </>
          )}
          {!hour.isOpen && (
            <span className="text-muted-foreground">Closed</span>
          )}
        </div>
      ))}
      <Button onClick={saveHours} disabled={saving}>
        {saving ? 'Saving...' : 'Save Hours'}
      </Button>
    </div>
  );
}
```

---

## Step 7: Update Settings Page with Business Hours

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
import { BusinessHoursEditor } from './business-hours-editor';

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
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              People who receive escalation notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMembersList clientId={clientId} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Business Hours</CardTitle>
            <CardDescription>
              Set when hot transfers should connect calls immediately
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessHoursEditor clientId={clientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 8: Update Incoming SMS with Hot Intent

**UPDATE** `src/lib/automations/incoming-sms.ts`:

Add these imports at the top:
```typescript
import { detectHotIntent } from '@/lib/services/openai';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { initiateRingGroup } from '@/lib/services/ring-group';
```

Add this block BEFORE the AI generation section (after step 6 "Pause active sequences"):

```typescript
  // 6.5 Check for hot intent BEFORE AI processing
  const isHotIntent = detectHotIntent(messageBody);

  if (isHotIntent) {
    const withinHours = await isWithinBusinessHours(client.id, client.timezone || 'America/Edmonton');

    if (withinHours) {
      const ringResult = await initiateRingGroup({
        leadId: lead.id,
        clientId: client.id,
        leadPhone: senderPhone,
        twilioNumber: client.twilioNumber!,
      });

      if (ringResult.initiated) {
        await sendSMS(
          senderPhone,
          client.twilioNumber!,
          `Great! We're calling you right now. Please pick up!`
        );

        await db.insert(conversations).values({
          leadId: lead.id,
          clientId: client.id,
          direction: 'outbound',
          messageType: 'hot_transfer',
          content: 'Initiated hot transfer call',
        });

        return {
          processed: true,
          leadId: lead.id,
          hotTransfer: true,
          callSid: ringResult.callSid,
        };
      }
    } else {
      await sendSMS(
        senderPhone,
        client.twilioNumber!,
        `Thanks for your interest! We're currently outside business hours, but someone will call you first thing tomorrow morning.`
      );

      await notifyTeamForEscalation({
        leadId: lead.id,
        clientId: client.id,
        twilioNumber: client.twilioNumber!,
        reason: 'Hot intent - outside business hours',
        lastMessage: messageBody,
      });

      return {
        processed: true,
        leadId: lead.id,
        hotTransfer: false,
        outsideHours: true,
      };
    }
  }
```

---

## Verify

1. `npm run dev`
2. Go to Settings → Set business hours
3. Add team member with `receiveHotTransfers` enabled
4. During business hours, text: "I'm ready to schedule an appointment"
5. Lead receives "Calling you now!"
6. Team phones ring simultaneously
7. First answer wins, others notified
8. After hours: same text → "outside hours" response + escalation

---

## System Complete! 🎉

Full system with:
- Phases 1-6: Core (missed calls, forms, AI SMS, sequences, dashboard)
- Phase 7: Admin (manage all clients from one login)
- Phase 8: Team escalation (multi-member notifications, claim system)
- Phase 9: Hot transfer (ring groups, business hours)
