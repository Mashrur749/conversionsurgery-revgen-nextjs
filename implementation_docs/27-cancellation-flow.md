# Phase 16b: Cancellation Flow

## Current State (after Phase 16a)
- Clients can access dashboard
- No way to cancel subscription
- No retention mechanism

## Goal
Strategic cancellation flow that shows value and offers alternatives.

---

## Step 1: Add Cancellation Tables to Schema

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// CANCELLATION REQUESTS
// ============================================
export const cancellationRequests = pgTable('cancellation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('pending'), // pending, scheduled_call, saved, cancelled
  reason: text('reason'),
  feedback: text('feedback'),
  valueShown: jsonb('value_shown'), // Stats shown at cancellation
  scheduledCallAt: timestamp('scheduled_call_at'),
  gracePeriodEnds: timestamp('grace_period_ends'),
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
  processedBy: varchar('processed_by', { length: 255 }),
});

export const cancellationReasonsEnum = pgEnum('cancellation_reason', [
  'too_expensive',
  'not_using',
  'switching_competitor',
  'business_closing',
  'missing_features',
  'poor_results',
  'other',
]);
```

Run: `npx drizzle-kit push`

---

## Step 2: Create Cancellation Service

**CREATE** `src/lib/services/cancellation.ts`:

```typescript
import { db } from '@/lib/db';
import { cancellationRequests, clients, dailyStats } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface ValueSummary {
  monthsActive: number;
  totalLeads: number;
  totalMessages: number;
  estimatedRevenue: number;
  monthlyCost: number;
  roi: number;
}

export async function getValueSummary(clientId: string): Promise<ValueSummary> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) throw new Error('Client not found');

  const createdAt = new Date(client.createdAt!);
  const now = new Date();
  const monthsActive = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));

  // Get all-time stats
  const [stats] = await db
    .select({
      totalLeads: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      totalMessages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(eq(dailyStats.clientId, clientId));

  const totalLeads = Number(stats?.totalLeads || 0);
  const totalMessages = Number(stats?.totalMessages || 0);
  
  // Estimate: 10% of leads convert, average job value $3000
  const estimatedRevenue = Math.round(totalLeads * 0.1 * 3000);
  const monthlyCost = 997;
  const totalCost = monthsActive * monthlyCost;
  const roi = totalCost > 0 ? Math.round((estimatedRevenue / totalCost) * 100) : 0;

  return {
    monthsActive,
    totalLeads,
    totalMessages,
    estimatedRevenue,
    monthlyCost,
    roi,
  };
}

export async function initiateCancellation(
  clientId: string,
  reason: string,
  feedback?: string
): Promise<string> {
  const valueSummary = await getValueSummary(clientId);

  const [request] = await db
    .insert(cancellationRequests)
    .values({
      clientId,
      reason,
      feedback,
      valueShown: valueSummary,
    })
    .returning();

  return request.id;
}

export async function scheduleRetentionCall(
  requestId: string,
  scheduledAt: Date
): Promise<void> {
  await db
    .update(cancellationRequests)
    .set({
      status: 'scheduled_call',
      scheduledCallAt: scheduledAt,
    })
    .where(eq(cancellationRequests.id, requestId));
}

export async function markAsSaved(requestId: string): Promise<void> {
  await db
    .update(cancellationRequests)
    .set({
      status: 'saved',
      processedAt: new Date(),
    })
    .where(eq(cancellationRequests.id, requestId));
}

export async function confirmCancellation(
  requestId: string,
  gracePeriodDays: number = 7
): Promise<void> {
  const gracePeriodEnds = new Date();
  gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);

  await db
    .update(cancellationRequests)
    .set({
      status: 'cancelled',
      gracePeriodEnds,
      processedAt: new Date(),
    })
    .where(eq(cancellationRequests.id, requestId));
}

export async function getPendingCancellation(clientId: string) {
  const [request] = await db
    .select()
    .from(cancellationRequests)
    .where(and(
      eq(cancellationRequests.clientId, clientId),
      eq(cancellationRequests.status, 'pending')
    ))
    .limit(1);

  return request;
}
```

---

## Step 3: Create Cancellation Pages

**CREATE** `src/app/(client)/client/cancel/page.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getValueSummary, getPendingCancellation } from '@/lib/services/cancellation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CancellationFlow } from './cancellation-flow';

export default async function CancelPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  // Check for pending cancellation
  const pending = await getPendingCancellation(session.clientId);
  if (pending) {
    redirect('/client/cancel/pending');
  }

  const valueSummary = await getValueSummary(session.clientId);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold">We're Sorry to See You Go</h1>
        <p className="text-muted-foreground mt-2">
          Before you leave, take a look at what you'd be giving up
        </p>
      </div>

      {/* Value Summary Card */}
      <Card className="border-2 border-green-500 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">Your Results So Far</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-700">{valueSummary.totalLeads}</p>
              <p className="text-sm text-green-600">Leads Captured</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-700">{valueSummary.totalMessages}</p>
              <p className="text-sm text-green-600">Messages Sent</p>
            </div>
          </div>

          <div className="border-t border-green-200 pt-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-700">
                ${valueSummary.estimatedRevenue.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">Estimated Revenue Generated</p>
            </div>
          </div>

          <div className="bg-green-100 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-green-800">
              {valueSummary.roi}% ROI
            </p>
            <p className="text-xs text-green-600">
              ${valueSummary.monthlyCost}/mo investment → ${valueSummary.estimatedRevenue.toLocaleString()} return
            </p>
          </div>
        </CardContent>
      </Card>

      <CancellationFlow clientId={session.clientId} valueSummary={valueSummary} />

      <div className="text-center">
        <Button asChild variant="link">
          <Link href="/client">← Never mind, take me back</Link>
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 4: Create Cancellation Flow Component

**CREATE** `src/app/(client)/client/cancel/cancellation-flow.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ValueSummary {
  monthsActive: number;
  totalLeads: number;
  totalMessages: number;
  estimatedRevenue: number;
  monthlyCost: number;
  roi: number;
}

interface Props {
  clientId: string;
  valueSummary: ValueSummary;
}

const REASONS = [
  { value: 'too_expensive', label: "It's too expensive" },
  { value: 'not_using', label: "I'm not using it enough" },
  { value: 'switching_competitor', label: "Switching to a competitor" },
  { value: 'business_closing', label: "Business is closing/slowing" },
  { value: 'missing_features', label: "Missing features I need" },
  { value: 'poor_results', label: "Not seeing results" },
  { value: 'other', label: "Other reason" },
];

export function CancellationFlow({ clientId, valueSummary }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleScheduleCall() {
    setSubmitting(true);
    await fetch('/api/client/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, feedback, action: 'schedule_call' }),
    });
    router.push('/client/cancel/call-scheduled');
  }

  async function handleConfirmCancel() {
    setSubmitting(true);
    await fetch('/api/client/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, feedback, action: 'confirm' }),
    });
    router.push('/client/cancel/confirmed');
  }

  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Help Us Understand</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason}>
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-2">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label>Additional feedback (optional)</Label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What could we have done better?"
              rows={3}
            />
          </div>

          <Button 
            onClick={() => setStep(2)} 
            disabled={!reason}
            className="w-full"
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before You Go...</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Would you like to schedule a quick call? We might be able to help with:
        </p>

        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          {reason === 'too_expensive' && (
            <li>Discuss pricing options or a temporary discount</li>
          )}
          {reason === 'not_using' && (
            <li>Show you features you might not know about</li>
          )}
          {reason === 'missing_features' && (
            <li>Share our roadmap or find workarounds</li>
          )}
          {reason === 'poor_results' && (
            <li>Review your setup and optimize for better results</li>
          )}
          <li>Answer any questions before you decide</li>
        </ul>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button onClick={handleScheduleCall} disabled={submitting}>
            Schedule a Call
          </Button>
          <Button 
            variant="outline" 
            onClick={handleConfirmCancel}
            disabled={submitting}
          >
            Cancel Anyway
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          If you cancel, you'll have 7 days to reactivate before losing your data
        </p>
      </CardContent>
    </Card>
  );
}
```

---

## Step 5: Create Cancellation API

**CREATE** `src/app/api/client/cancel/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  initiateCancellation,
  scheduleRetentionCall,
  confirmCancellation,
} from '@/lib/services/cancellation';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/services/email';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reason, feedback, action } = await request.json();

  // Create cancellation request
  const requestId = await initiateCancellation(clientId, reason, feedback);

  if (action === 'schedule_call') {
    // Schedule call for tomorrow 10am
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 1);
    scheduledAt.setHours(10, 0, 0, 0);

    await scheduleRetentionCall(requestId, scheduledAt);

    // Notify admin
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    // Send admin notification email
    await sendEmail(
      process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com',
      `🚨 Retention Call Scheduled: ${client?.businessName}`,
      `<p>A client wants to cancel and has scheduled a retention call.</p>
       <p><strong>Business:</strong> ${client?.businessName}</p>
       <p><strong>Reason:</strong> ${reason}</p>
       <p><strong>Feedback:</strong> ${feedback || 'None provided'}</p>
       <p><strong>Scheduled:</strong> Tomorrow at 10am</p>`
    );

    return NextResponse.json({ success: true, action: 'call_scheduled' });
  }

  if (action === 'confirm') {
    await confirmCancellation(requestId, 7);

    // Notify admin
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    await sendEmail(
      process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com',
      `❌ Client Cancelled: ${client?.businessName}`,
      `<p>A client has cancelled their subscription.</p>
       <p><strong>Business:</strong> ${client?.businessName}</p>
       <p><strong>Reason:</strong> ${reason}</p>
       <p><strong>Feedback:</strong> ${feedback || 'None provided'}</p>
       <p><strong>Grace Period:</strong> 7 days</p>`
    );

    return NextResponse.json({ success: true, action: 'cancelled' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

---

## Step 6: Create Confirmation Pages

**CREATE** `src/app/(client)/client/cancel/call-scheduled/page.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CallScheduledPage() {
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <Card className="border-green-500">
        <CardHeader>
          <CardTitle>📞 Call Scheduled!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We'll call you tomorrow at 10am to discuss your concerns.
          </p>
          <p className="text-sm text-muted-foreground">
            Your account remains active. No action needed until we talk.
          </p>
        </CardContent>
      </Card>

      <Button asChild>
        <Link href="/client">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
```

**CREATE** `src/app/(client)/client/cancel/confirmed/page.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CancellationConfirmedPage() {
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cancellation Confirmed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your subscription has been cancelled.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>7-day grace period:</strong> Your account remains active for 7 more days. 
              You can reactivate anytime before then.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            We're sorry to see you go. If you change your mind, we'd love to have you back.
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/client">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
```

---

## Step 7: Add Cancel Link to Settings

**UPDATE** `src/app/(client)/client/settings/page.tsx`:

Add at the bottom:

```typescript
<Card className="border-red-200">
  <CardHeader>
    <CardTitle className="text-red-600">Danger Zone</CardTitle>
  </CardHeader>
  <CardContent>
    <Button asChild variant="destructive">
      <Link href="/client/cancel">
        Cancel Subscription
      </Link>
    </Button>
  </CardContent>
</Card>
```

---

## Verify

1. `npm run dev`
2. Go to Client Settings → Cancel Subscription
3. See value summary with ROI
4. Select reason → continue
5. Choose "Schedule a Call" or "Cancel Anyway"
6. Verify admin receives email notification

---

## Next
Proceed to **Phase 17a** for revenue attribution.
