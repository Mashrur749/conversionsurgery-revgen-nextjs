# Phase 8b: Claim Pages & SMS Update

## Current State (after Phase 8a)
- Team members and escalation claims tables exist
- `notifyTeamForEscalation()` and `claimEscalation()` services exist

## Goal
Create claim pages, API routes, and update incoming SMS to use team escalation.

---

## Step 1: Create Claim API

**CREATE** `src/app/api/claim/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { claimEscalation } from '@/lib/services/team-escalation';
import { z } from 'zod';

const schema = z.object({
  token: z.string().min(1),
  teamMemberId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, teamMemberId } = schema.parse(body);

    const result = await claimEscalation(token, teamMemberId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    console.error('Claim error:', error);
    return NextResponse.json({ success: false, error: 'Failed to claim' }, { status: 500 });
  }
}
```

---

## Step 2: Create Claim Page

**CREATE** `src/app/(auth)/claim/page.tsx`:

```typescript
import { db } from '@/lib/db';
import { escalationClaims, leads, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { ClaimForm } from './claim-form';

interface Props {
  searchParams: { token?: string };
}

export default async function ClaimPage({ searchParams }: Props) {
  const { token } = searchParams;

  if (!token) {
    redirect('/claim-error?reason=invalid');
  }

  const [escalation] = await db
    .select()
    .from(escalationClaims)
    .where(eq(escalationClaims.claimToken, token))
    .limit(1);

  if (!escalation) {
    redirect('/claim-error?reason=invalid');
  }

  if (escalation.status !== 'pending') {
    const [claimer] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, escalation.claimedBy!))
      .limit(1);

    redirect(`/claim-error?reason=claimed&by=${encodeURIComponent(claimer?.name || 'Someone')}`);
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, escalation.clientId),
      eq(teamMembers.isActive, true)
    ));

  return (
    <Card className="max-w-md mx-auto mt-20">
      <CardHeader>
        <CardTitle>Claim This Lead</CardTitle>
        <CardDescription>
          Select your name to claim and respond to this lead
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="font-medium">{lead?.name || formatPhoneNumber(lead?.phone || '')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            "{escalation.lastLeadMessage}"
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Reason: {escalation.escalationReason}
          </p>
        </div>

        <ClaimForm token={token} members={members} leadId={lead?.id || ''} />
      </CardContent>
    </Card>
  );
}
```

---

## Step 3: Create Claim Form Component

**CREATE** `src/app/(auth)/claim/claim-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamMember {
  id: string;
  name: string;
}

interface Props {
  token: string;
  members: TeamMember[];
  leadId: string;
}

export function ClaimForm({ token, members, leadId }: Props) {
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClaim() {
    if (!selectedMember) return;

    setLoading(true);
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, teamMemberId: selectedMember }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/leads/${leadId}?claimed=true`);
      } else {
        alert(data.error || 'Failed to claim');
        if (data.error === 'Already claimed') {
          router.push(`/claim-error?reason=claimed&by=${encodeURIComponent(data.claimedBy)}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Select value={selectedMember} onValueChange={setSelectedMember}>
        <SelectTrigger>
          <SelectValue placeholder="Select your name..." />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={handleClaim}
        disabled={!selectedMember || loading}
        className="w-full"
      >
        {loading ? 'Claiming...' : 'Claim & Respond'}
      </Button>
    </div>
  );
}
```

---

## Step 4: Create Claim Error Page

**CREATE** `src/app/(auth)/claim-error/page.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Props {
  searchParams: { reason?: string; by?: string };
}

export default function ClaimErrorPage({ searchParams }: Props) {
  const { reason, by } = searchParams;

  let title = 'Claim Error';
  let message = 'Something went wrong with this claim link.';

  if (reason === 'invalid') {
    title = 'Invalid Link';
    message = 'This claim link is invalid or has expired.';
  } else if (reason === 'claimed') {
    title = 'Already Claimed';
    message = `${by || 'Someone'} is already handling this lead.`;
  }

  return (
    <Card className="max-w-md mx-auto mt-20 text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{message}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Step 5: Update Incoming SMS Handler

**REPLACE** entire `src/lib/automations/incoming-sms.ts`:

```typescript
import { db } from '@/lib/db';
import { clients, leads, conversations, blockedNumbers, scheduledMessages, dailyStats } from '@/lib/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail, actionRequiredEmail } from '@/lib/services/resend';
import { generateAIResponse } from '@/lib/services/openai';
import { notifyTeamForEscalation } from '@/lib/services/team-escalation';
import { eq, and, sql } from 'drizzle-orm';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone';
import { renderTemplate } from '@/lib/utils/templates';

interface IncomingSMSPayload {
  To: string;
  From: string;
  Body: string;
  MessageSid: string;
}

const STOP_WORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];

export async function handleIncomingSMS(payload: IncomingSMSPayload) {
  const { To, From, Body, MessageSid } = payload;

  const senderPhone = normalizePhoneNumber(From);
  const twilioNumber = normalizePhoneNumber(To);
  const messageBody = Body.trim();

  // 1. Find client by Twilio number
  const [client] = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.twilioNumber, twilioNumber),
      eq(clients.status, 'active')
    ))
    .limit(1);

  if (!client) {
    console.log('No client found for Twilio number:', twilioNumber);
    return { processed: false, reason: 'No client for this number' };
  }

  // 2. Handle opt-out
  if (STOP_WORDS.includes(messageBody.toLowerCase())) {
    return await handleOptOut(client, senderPhone);
  }

  // 3. Check blocked
  const [blocked] = await db
    .select()
    .from(blockedNumbers)
    .where(and(
      eq(blockedNumbers.clientId, client.id),
      eq(blockedNumbers.phone, senderPhone)
    ))
    .limit(1);

  if (blocked) {
    return { processed: false, reason: 'Number is blocked' };
  }

  // 4. Find or create lead
  let [lead] = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, client.id),
      eq(leads.phone, senderPhone)
    ))
    .limit(1);

  const isNewLead = !lead;

  if (!lead) {
    [lead] = await db
      .insert(leads)
      .values({
        clientId: client.id,
        phone: senderPhone,
        source: 'sms',
        status: 'new',
      })
      .returning();
  }

  // 5. Log inbound message
  await db.insert(conversations).values({
    leadId: lead.id,
    clientId: client.id,
    direction: 'inbound',
    messageType: 'sms',
    content: messageBody,
    twilioSid: MessageSid,
  });

  // 6. Pause active sequences
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'Lead replied',
    })
    .where(and(
      eq(scheduledMessages.leadId, lead.id),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // 7. Get conversation history
  const history = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(conversations.createdAt)
    .limit(20);

  const conversationHistory = history.map(msg => ({
    role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  // 8. Generate AI response
  const aiResult = await generateAIResponse(
    messageBody,
    client.businessName,
    client.ownerName,
    conversationHistory
  );

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/leads/${lead.id}`;

  // 9. Handle escalation
  if (aiResult.shouldEscalate) {
    await db
      .update(leads)
      .set({
        actionRequired: true,
        actionRequiredReason: aiResult.escalationReason,
        status: 'action_required',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    const ackMessage = renderTemplate('escalation_ack', {
      ownerName: client.ownerName,
    });

    await sendSMS(senderPhone, client.twilioNumber!, ackMessage);

    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'escalation',
      content: ackMessage,
    });

    // Notify team (new behavior)
    const escalationResult = await notifyTeamForEscalation({
      leadId: lead.id,
      clientId: client.id,
      twilioNumber: client.twilioNumber!,
      reason: aiResult.escalationReason || 'Needs human response',
      lastMessage: messageBody,
    });

    // Fallback to single contractor if no team members
    if (escalationResult.notified === 0) {
      if (client.notificationSms) {
        await sendSMS(
          client.phone,
          client.twilioNumber!,
          `⚠️ ${lead.name || formatPhoneNumber(senderPhone)} needs you: "${messageBody.substring(0, 80)}..." ${dashboardUrl}`
        );
      }
      if (client.notificationEmail) {
        const emailData = actionRequiredEmail({
          businessName: client.businessName,
          leadName: lead.name || undefined,
          leadPhone: formatPhoneNumber(senderPhone),
          reason: aiResult.escalationReason || 'Needs human response',
          lastMessage: messageBody,
          dashboardUrl,
        });
        await sendEmail({ to: client.email, ...emailData });
      }
    }

    return {
      processed: true,
      leadId: lead.id,
      escalated: true,
      reason: aiResult.escalationReason,
      teamNotified: escalationResult.notified,
    };
  }

  // 10. Send AI response
  const smsResult = await sendSMS(senderPhone, client.twilioNumber!, aiResult.response);

  if (smsResult.success) {
    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'ai_response',
      content: aiResult.response,
      twilioSid: smsResult.sid,
      aiConfidence: String(aiResult.confidence),
    });

    // Update stats
    const today = new Date().toISOString().split('T')[0];
    await db
      .insert(dailyStats)
      .values({
        clientId: client.id,
        date: today,
        messagesSent: 1,
        conversationsStarted: isNewLead ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [dailyStats.clientId, dailyStats.date],
        set: {
          messagesSent: sql`${dailyStats.messagesSent} + 1`,
          conversationsStarted: isNewLead
            ? sql`${dailyStats.conversationsStarted} + 1`
            : dailyStats.conversationsStarted,
        },
      });

    await db
      .update(clients)
      .set({
        messagesSentThisMonth: sql`${clients.messagesSentThisMonth} + 1`,
      })
      .where(eq(clients.id, client.id));
  }

  // 11. Notify contractor of activity
  if (client.notificationSms) {
    await sendSMS(
      client.phone,
      client.twilioNumber!,
      `💬 ${lead.name || formatPhoneNumber(senderPhone)}: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}" — AI replied. ${dashboardUrl}`
    );
  }

  return {
    processed: true,
    leadId: lead.id,
    aiResponse: aiResult.response,
    confidence: aiResult.confidence,
  };
}

async function handleOptOut(client: typeof clients.$inferSelect, phone: string) {
  await db
    .insert(blockedNumbers)
    .values({
      clientId: client.id,
      phone,
      reason: 'opt_out',
    })
    .onConflictDoNothing();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, client.id),
      eq(leads.phone, phone)
    ))
    .limit(1);

  if (lead) {
    await db
      .update(leads)
      .set({
        optedOut: true,
        optedOutAt: new Date(),
        status: 'opted_out',
      })
      .where(eq(leads.id, lead.id));

    await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Opted out',
      })
      .where(and(
        eq(scheduledMessages.leadId, lead.id),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      ));
  }

  const confirmMessage = renderTemplate('opt_out_confirmation', {
    businessName: client.businessName,
  });

  await sendSMS(phone, client.twilioNumber!, confirmMessage);

  return { processed: true, optedOut: true };
}
```

---

## Verify

1. `npm run dev` with no errors
2. Files exist:
   - `src/app/api/claim/route.ts`
   - `src/app/(auth)/claim/page.tsx`
   - `src/app/(auth)/claim/claim-form.tsx`
   - `src/app/(auth)/claim-error/page.tsx`
3. Incoming SMS handler imports `notifyTeamForEscalation`

---

## Next
Proceed to **Phase 8c** for team members UI in settings.
