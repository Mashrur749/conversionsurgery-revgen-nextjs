# Phase 17a: Revenue Attribution

## Current State (after Phase 16)
- Track leads and messages
- No way to track actual revenue
- Can't prove ROI with real data

## Goal
Track lead → appointment → job won → revenue for true ROI calculation.

---

## Step 1: Add Revenue Tracking to Schema

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// REVENUE TRACKING
// ============================================
export const jobStatusEnum = pgEnum('job_status', [
  'lead',
  'quoted',
  'won',
  'lost',
  'completed',
]);

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').default('lead'),
  
  // Financial tracking
  quoteAmount: integer('quote_amount'), // cents
  depositAmount: integer('deposit_amount'), // cents
  finalAmount: integer('final_amount'), // cents
  paidAmount: integer('paid_amount').default(0), // cents
  
  // Job details
  description: text('description'),
  address: text('address'),
  scheduledDate: date('scheduled_date'),
  completedDate: date('completed_date'),
  
  // Metadata
  wonAt: timestamp('won_at'),
  lostAt: timestamp('lost_at'),
  lostReason: varchar('lost_reason', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  clientIdx: index('idx_jobs_client').on(table.clientId),
  statusIdx: index('idx_jobs_status').on(table.status),
}));

export const revenueEvents = pgTable('revenue_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(), // quote_sent, deposit_received, job_won, payment_received, job_completed
  amount: integer('amount'), // cents
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  lead: one(leads, { fields: [jobs.leadId], references: [leads.id] }),
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  events: many(revenueEvents),
}));

export const revenueEventsRelations = relations(revenueEvents, ({ one }) => ({
  job: one(jobs, { fields: [revenueEvents.jobId], references: [jobs.id] }),
  client: one(clients, { fields: [revenueEvents.clientId], references: [clients.id] }),
}));
```

Run: `npx drizzle-kit push`

---

## Step 2: Create Revenue Service

**CREATE** `src/lib/services/revenue.ts`:

```typescript
import { db } from '@/lib/db';
import { jobs, revenueEvents, leads } from '@/lib/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

export async function createJobFromLead(
  leadId: string,
  clientId: string,
  description?: string
): Promise<string> {
  const [job] = await db
    .insert(jobs)
    .values({
      leadId,
      clientId,
      status: 'lead',
      description,
    })
    .returning();

  await db.insert(revenueEvents).values({
    jobId: job.id,
    clientId,
    eventType: 'job_created',
  });

  return job.id;
}

export async function updateJobStatus(
  jobId: string,
  status: 'lead' | 'quoted' | 'won' | 'lost' | 'completed',
  data?: {
    quoteAmount?: number;
    finalAmount?: number;
    lostReason?: string;
  }
): Promise<void> {
  const updates: any = { status, updatedAt: new Date() };

  if (status === 'quoted' && data?.quoteAmount) {
    updates.quoteAmount = data.quoteAmount;
  }

  if (status === 'won') {
    updates.wonAt = new Date();
    if (data?.finalAmount) updates.finalAmount = data.finalAmount;
  }

  if (status === 'lost') {
    updates.lostAt = new Date();
    updates.lostReason = data?.lostReason;
  }

  if (status === 'completed') {
    updates.completedDate = new Date().toISOString().split('T')[0];
  }

  const [job] = await db
    .update(jobs)
    .set(updates)
    .where(eq(jobs.id, jobId))
    .returning();

  // Log event
  await db.insert(revenueEvents).values({
    jobId,
    clientId: job.clientId!,
    eventType: `status_${status}`,
    amount: status === 'won' ? (data?.finalAmount || job.quoteAmount) : undefined,
  });
}

export async function recordPayment(
  jobId: string,
  amount: number,
  notes?: string
): Promise<void> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) throw new Error('Job not found');

  const newPaidAmount = (job.paidAmount || 0) + amount;

  await db
    .update(jobs)
    .set({ paidAmount: newPaidAmount, updatedAt: new Date() })
    .where(eq(jobs.id, jobId));

  await db.insert(revenueEvents).values({
    jobId,
    clientId: job.clientId!,
    eventType: 'payment_received',
    amount,
    notes,
  });
}

export interface RevenueStats {
  period: string;
  totalLeads: number;
  totalQuotes: number;
  totalWon: number;
  totalLost: number;
  totalCompleted: number;
  conversionRate: number;
  totalQuoteValue: number;
  totalWonValue: number;
  totalPaid: number;
  avgJobValue: number;
}

export async function getRevenueStats(
  clientId: string,
  startDate?: Date
): Promise<RevenueStats> {
  const dateFilter = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      totalLeads: sql<number>`count(*) filter (where status = 'lead')`,
      totalQuotes: sql<number>`count(*) filter (where status = 'quoted')`,
      totalWon: sql<number>`count(*) filter (where status = 'won' or status = 'completed')`,
      totalLost: sql<number>`count(*) filter (where status = 'lost')`,
      totalCompleted: sql<number>`count(*) filter (where status = 'completed')`,
      totalQuoteValue: sql<number>`coalesce(sum(quote_amount) filter (where status = 'quoted'), 0)`,
      totalWonValue: sql<number>`coalesce(sum(coalesce(final_amount, quote_amount)) filter (where status = 'won' or status = 'completed'), 0)`,
      totalPaid: sql<number>`coalesce(sum(paid_amount), 0)`,
    })
    .from(jobs)
    .where(and(
      eq(jobs.clientId, clientId),
      gte(jobs.createdAt, dateFilter)
    ));

  const totalLeads = Number(stats?.totalLeads || 0);
  const totalWon = Number(stats?.totalWon || 0);
  const totalQuotes = Number(stats?.totalQuotes || 0);

  return {
    period: '30 days',
    totalLeads,
    totalQuotes,
    totalWon,
    totalLost: Number(stats?.totalLost || 0),
    totalCompleted: Number(stats?.totalCompleted || 0),
    conversionRate: totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0,
    totalQuoteValue: Number(stats?.totalQuoteValue || 0),
    totalWonValue: Number(stats?.totalWonValue || 0),
    totalPaid: Number(stats?.totalPaid || 0),
    avgJobValue: totalWon > 0 ? Math.round(Number(stats?.totalWonValue || 0) / totalWon) : 0,
  };
}

export async function getRecentJobs(clientId: string, limit: number = 10) {
  return db
    .select({
      job: jobs,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(jobs)
    .leftJoin(leads, eq(jobs.leadId, leads.id))
    .where(eq(jobs.clientId, clientId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}
```

---

## Step 3: Create Jobs API Routes

**CREATE** `src/app/api/admin/clients/[id]/jobs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRecentJobs, getRevenueStats, createJobFromLead } from '@/lib/services/revenue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [jobs, stats] = await Promise.all([
    getRecentJobs(params.id, 20),
    getRevenueStats(params.id),
  ]);

  return NextResponse.json({ jobs, stats });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { leadId, description } = await request.json();
  const jobId = await createJobFromLead(leadId, params.id, description);

  return NextResponse.json({ jobId });
}
```

**CREATE** `src/app/api/admin/clients/[id]/jobs/[jobId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateJobStatus, recordPayment } from '@/lib/services/revenue';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; jobId: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === 'update_status') {
    await updateJobStatus(params.jobId, body.status, {
      quoteAmount: body.quoteAmount,
      finalAmount: body.finalAmount,
      lostReason: body.lostReason,
    });
  } else if (body.action === 'record_payment') {
    await recordPayment(params.jobId, body.amount, body.notes);
  }

  return NextResponse.json({ success: true });
}
```

---

## Step 4: Create Revenue Dashboard Page

**CREATE** `src/app/(dashboard)/admin/clients/[id]/revenue/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getRevenueStats, getRecentJobs } from '@/lib/services/revenue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RevenueMetrics } from './revenue-metrics';
import { JobsList } from './jobs-list';

interface Props {
  params: { id: string };
}

export default async function RevenuePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) notFound();

  const [stats, jobs] = await Promise.all([
    getRevenueStats(params.id),
    getRecentJobs(params.id, 20),
  ]);

  const monthlyCost = 997 * 100; // cents
  const roi = monthlyCost > 0 ? Math.round((stats.totalWonValue / monthlyCost) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Revenue Attribution</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${params.id}`}>← Back</Link>
        </Button>
      </div>

      <RevenueMetrics stats={stats} roi={roi} />

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <JobsList clientId={params.id} jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 5: Create Revenue Metrics Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/revenue/revenue-metrics.tsx`:

```typescript
import { Card, CardContent } from '@/components/ui/card';

interface RevenueStats {
  totalLeads: number;
  totalQuotes: number;
  totalWon: number;
  totalLost: number;
  totalCompleted: number;
  conversionRate: number;
  totalQuoteValue: number;
  totalWonValue: number;
  totalPaid: number;
  avgJobValue: number;
}

interface Props {
  stats: RevenueStats;
  roi: number;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export function RevenueMetrics({ stats, roi }: Props) {
  return (
    <div className="space-y-4">
      {/* ROI Banner */}
      <Card className="border-2 border-green-500 bg-green-50">
        <CardContent className="py-6">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-4xl font-bold text-green-700">{roi}%</p>
              <p className="text-sm text-green-600">Return on Investment</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-green-700">{formatMoney(stats.totalWonValue)}</p>
              <p className="text-sm text-green-600">Revenue Attributed</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-green-700">{formatMoney(stats.totalPaid)}</p>
              <p className="text-sm text-green-600">Collected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.totalLeads}</p>
            <p className="text-sm text-muted-foreground">Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.totalQuotes}</p>
            <p className="text-sm text-muted-foreground">Quoted</p>
            <p className="text-xs text-muted-foreground">{formatMoney(stats.totalQuoteValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.totalWon}</p>
            <p className="text-sm text-muted-foreground">Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-red-600">{stats.totalLost}</p>
            <p className="text-sm text-muted-foreground">Lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.conversionRate}%</p>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Average Job Value */}
      <Card>
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Average Job Value</span>
            <span className="text-2xl font-bold">{formatMoney(stats.avgJobValue)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 6: Create Jobs List Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/revenue/jobs-list.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Job {
  job: {
    id: string;
    status: string | null;
    quoteAmount: number | null;
    finalAmount: number | null;
    paidAmount: number | null;
    createdAt: Date | null;
  };
  leadName: string | null;
  leadPhone: string | null;
}

interface Props {
  clientId: string;
  jobs: Job[];
}

const statusColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-800',
  quoted: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  completed: 'bg-purple-100 text-purple-800',
};

export function JobsList({ clientId, jobs }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateStatus(jobId: string, status: string, amount?: number) {
    setUpdating(jobId);

    await fetch(`/api/admin/clients/${clientId}/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        status,
        quoteAmount: status === 'quoted' ? amount : undefined,
        finalAmount: status === 'won' ? amount : undefined,
      }),
    });

    setUpdating(null);
    router.refresh();
  }

  function formatMoney(cents: number | null): string {
    if (!cents) return '-';
    return `$${(cents / 100).toLocaleString()}`;
  }

  return (
    <div className="space-y-2">
      {jobs.map(({ job, leadName, leadPhone }) => (
        <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <p className="font-medium">{leadName || leadPhone}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusColors[job.status || 'lead']}>
                {job.status || 'lead'}
              </Badge>
              {job.quoteAmount && (
                <span className="text-sm text-muted-foreground">
                  Quote: {formatMoney(job.quoteAmount)}
                </span>
              )}
              {job.finalAmount && (
                <span className="text-sm text-green-600">
                  Won: {formatMoney(job.finalAmount)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={job.status || 'lead'}
              onValueChange={(v) => updateStatus(job.id, v)}
              disabled={updating === job.id}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}

      {jobs.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No jobs tracked yet. Jobs are created when leads progress through the pipeline.
        </p>
      )}
    </div>
  );
}
```

---

## Step 7: Add Revenue Link to Client Page

**UPDATE** `src/app/(dashboard)/admin/clients/[id]/page.tsx`:

Add button:

```typescript
<Button asChild variant="outline">
  <Link href={`/admin/clients/${client.id}/revenue`}>
    💰 Revenue Tracking
  </Link>
</Button>
```

---

## Verify

1. `npm run dev`
2. Create a job from a lead
3. Update status: Lead → Quoted → Won
4. View revenue dashboard
5. See ROI calculation

---

## Next
Proceed to **Phase 17b** for lead scoring.
