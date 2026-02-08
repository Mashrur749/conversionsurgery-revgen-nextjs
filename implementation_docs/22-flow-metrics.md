# Phase 14d: Flow Metrics (Aggregate Template Performance)

## Prerequisites
- Phase 14a (Flow Schema with Templates)
- Phase 14b (Flow Builder UI)
- Phase 14c (AI Flow Triggering)

## Goal
Track flow performance at the **template level** across all clients to:
1. Identify best-performing templates
2. Make data-driven template improvements
3. Show simple outcomes to clients (not stats)

**Not building:** Per-client A/B testing (insufficient volume)

---

## Step 1: Add Metrics Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// TEMPLATE PERFORMANCE METRICS (Aggregate)
// ============================================

// Daily rollup of template performance across all clients
export const templateMetricsDaily = pgTable('template_metrics_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  
  // Volume
  executionsStarted: integer('executions_started').default(0),
  executionsCompleted: integer('executions_completed').default(0),
  executionsCancelled: integer('executions_cancelled').default(0),
  
  // Messages
  messagesSent: integer('messages_sent').default(0),
  messagesDelivered: integer('messages_delivered').default(0),
  messagesFailed: integer('messages_failed').default(0),
  
  // Engagement
  leadsResponded: integer('leads_responded').default(0),        // Unique leads who replied
  totalResponses: integer('total_responses').default(0),        // Total reply messages
  avgResponseTimeMinutes: integer('avg_response_time_minutes'), // Time to first reply
  
  // Conversions (outcome depends on category)
  conversions: integer('conversions').default(0),               // Scheduled/Paid/Reviewed
  conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }), // $ for payment flows
  
  // Opt-outs
  optOuts: integer('opt_outs').default(0),                      // STOP replies
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueTemplateDate: uniqueIndex('template_date_idx').on(table.templateId, table.date),
}));

// Step-level performance (which step gets responses?)
export const templateStepMetrics = pgTable('template_step_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  date: date('date').notNull(),
  
  messagesSent: integer('messages_sent').default(0),
  responsesReceived: integer('responses_received').default(0),  // Replies after this step
  skipped: integer('skipped').default(0),                       // Skipped due to conditions
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueTemplateStepDate: uniqueIndex('template_step_date_idx').on(
    table.templateId, 
    table.stepNumber, 
    table.date
  ),
}));

// Client-level outcomes (simple, not statistical)
export const clientFlowOutcomes = pgTable('client_flow_outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'set null' }),
  period: varchar('period', { length: 10 }).notNull(), // '2024-01' monthly
  
  // Simple outcomes
  leadsContacted: integer('leads_contacted').default(0),
  leadsResponded: integer('leads_responded').default(0),
  conversions: integer('conversions').default(0),
  revenue: decimal('revenue', { precision: 10, scale: 2 }).default('0'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueClientFlowPeriod: uniqueIndex('client_flow_period_idx').on(
    table.clientId, 
    table.flowId, 
    table.period
  ),
}));
```

---

## Step 2: Create Metrics Collection Service

**CREATE** `src/lib/services/flow-metrics.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  templateMetricsDaily, 
  templateStepMetrics,
  clientFlowOutcomes,
  flowExecutions,
  flowStepExecutions,
  flows,
  messages,
  leads,
} from '@/lib/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Record a flow execution start
 */
export async function recordExecutionStart(
  flowId: string,
  templateId: string | null
): Promise<void> {
  if (!templateId) return;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      executionsStarted: 1,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        executionsStarted: sql`${templateMetricsDaily.executionsStarted} + 1`,
      },
    });
}

/**
 * Record a flow execution completion
 */
export async function recordExecutionComplete(
  flowId: string,
  templateId: string | null,
  converted: boolean,
  conversionValue?: number
): Promise<void> {
  if (!templateId) return;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      executionsCompleted: 1,
      conversions: converted ? 1 : 0,
      conversionValue: conversionValue?.toString() || '0',
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        executionsCompleted: sql`${templateMetricsDaily.executionsCompleted} + 1`,
        conversions: converted 
          ? sql`${templateMetricsDaily.conversions} + 1` 
          : templateMetricsDaily.conversions,
        conversionValue: conversionValue
          ? sql`${templateMetricsDaily.conversionValue} + ${conversionValue}`
          : templateMetricsDaily.conversionValue,
      },
    });
}

/**
 * Record a message sent from a flow step
 */
export async function recordStepMessageSent(
  templateId: string | null,
  stepNumber: number
): Promise<void> {
  if (!templateId) return;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Template daily
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      messagesSent: 1,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        messagesSent: sql`${templateMetricsDaily.messagesSent} + 1`,
      },
    });
  
  // Step level
  await db
    .insert(templateStepMetrics)
    .values({
      templateId,
      stepNumber,
      date: today,
      messagesSent: 1,
    })
    .onConflictDoUpdate({
      target: [templateStepMetrics.templateId, templateStepMetrics.stepNumber, templateStepMetrics.date],
      set: {
        messagesSent: sql`${templateStepMetrics.messagesSent} + 1`,
      },
    });
}

/**
 * Record a lead response (call after inbound message during active flow)
 */
export async function recordLeadResponse(
  templateId: string | null,
  stepNumber: number,
  responseTimeMinutes: number
): Promise<void> {
  if (!templateId) return;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Template daily
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      leadsResponded: 1,
      totalResponses: 1,
      avgResponseTimeMinutes: responseTimeMinutes,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        leadsResponded: sql`${templateMetricsDaily.leadsResponded} + 1`,
        totalResponses: sql`${templateMetricsDaily.totalResponses} + 1`,
        // Running average (simplified)
        avgResponseTimeMinutes: sql`(
          COALESCE(${templateMetricsDaily.avgResponseTimeMinutes}, 0) * ${templateMetricsDaily.totalResponses} + ${responseTimeMinutes}
        ) / (${templateMetricsDaily.totalResponses} + 1)`,
      },
    });
  
  // Step level
  await db
    .insert(templateStepMetrics)
    .values({
      templateId,
      stepNumber,
      date: today,
      responsesReceived: 1,
    })
    .onConflictDoUpdate({
      target: [templateStepMetrics.templateId, templateStepMetrics.stepNumber, templateStepMetrics.date],
      set: {
        responsesReceived: sql`${templateStepMetrics.responsesReceived} + 1`,
      },
    });
}

/**
 * Record opt-out (STOP message)
 */
export async function recordOptOut(templateId: string | null): Promise<void> {
  if (!templateId) return;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      optOuts: 1,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        optOuts: sql`${templateMetricsDaily.optOuts} + 1`,
      },
    });
}

/**
 * Get aggregate template performance for admin dashboard
 */
export async function getTemplatePerformance(
  templateId: string,
  days: number = 30
): Promise<{
  executions: number;
  completionRate: number;
  responseRate: number;
  conversionRate: number;
  avgResponseTimeMinutes: number;
  optOutRate: number;
  totalRevenue: number;
  stepPerformance: Array<{
    stepNumber: number;
    sent: number;
    responseRate: number;
  }>;
}> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
  
  // Aggregate template metrics
  const metrics = await db
    .select({
      executions: sql<number>`SUM(${templateMetricsDaily.executionsStarted})`,
      completed: sql<number>`SUM(${templateMetricsDaily.executionsCompleted})`,
      messagesSent: sql<number>`SUM(${templateMetricsDaily.messagesSent})`,
      responded: sql<number>`SUM(${templateMetricsDaily.leadsResponded})`,
      conversions: sql<number>`SUM(${templateMetricsDaily.conversions})`,
      revenue: sql<number>`SUM(${templateMetricsDaily.conversionValue})`,
      avgResponseTime: sql<number>`AVG(${templateMetricsDaily.avgResponseTimeMinutes})`,
      optOuts: sql<number>`SUM(${templateMetricsDaily.optOuts})`,
    })
    .from(templateMetricsDaily)
    .where(
      and(
        eq(templateMetricsDaily.templateId, templateId),
        gte(templateMetricsDaily.date, startDate)
      )
    )
    .then(r => r[0]);

  // Step-level performance
  const stepMetrics = await db
    .select({
      stepNumber: templateStepMetrics.stepNumber,
      sent: sql<number>`SUM(${templateStepMetrics.messagesSent})`,
      responses: sql<number>`SUM(${templateStepMetrics.responsesReceived})`,
    })
    .from(templateStepMetrics)
    .where(
      and(
        eq(templateStepMetrics.templateId, templateId),
        gte(templateStepMetrics.date, startDate)
      )
    )
    .groupBy(templateStepMetrics.stepNumber)
    .orderBy(templateStepMetrics.stepNumber);

  const executions = metrics?.executions || 0;
  const completed = metrics?.completed || 0;
  const responded = metrics?.responded || 0;
  const conversions = metrics?.conversions || 0;
  const optOuts = metrics?.optOuts || 0;

  return {
    executions,
    completionRate: executions > 0 ? (completed / executions) * 100 : 0,
    responseRate: executions > 0 ? (responded / executions) * 100 : 0,
    conversionRate: executions > 0 ? (conversions / executions) * 100 : 0,
    avgResponseTimeMinutes: metrics?.avgResponseTime || 0,
    optOutRate: executions > 0 ? (optOuts / executions) * 100 : 0,
    totalRevenue: metrics?.revenue || 0,
    stepPerformance: stepMetrics.map(s => ({
      stepNumber: s.stepNumber,
      sent: s.sent || 0,
      responseRate: s.sent > 0 ? ((s.responses || 0) / s.sent) * 100 : 0,
    })),
  };
}

/**
 * Compare templates in same category
 */
export async function compareTemplates(
  category: string,
  days: number = 30
): Promise<Array<{
  templateId: string;
  templateName: string;
  executions: number;
  responseRate: number;
  conversionRate: number;
  optOutRate: number;
}>> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
  
  const results = await db
    .select({
      templateId: flowTemplates.id,
      templateName: flowTemplates.name,
      executions: sql<number>`COALESCE(SUM(${templateMetricsDaily.executionsStarted}), 0)`,
      responded: sql<number>`COALESCE(SUM(${templateMetricsDaily.leadsResponded}), 0)`,
      conversions: sql<number>`COALESCE(SUM(${templateMetricsDaily.conversions}), 0)`,
      optOuts: sql<number>`COALESCE(SUM(${templateMetricsDaily.optOuts}), 0)`,
    })
    .from(flowTemplates)
    .leftJoin(
      templateMetricsDaily,
      and(
        eq(templateMetricsDaily.templateId, flowTemplates.id),
        gte(templateMetricsDaily.date, startDate)
      )
    )
    .where(eq(flowTemplates.category, category as any))
    .groupBy(flowTemplates.id, flowTemplates.name)
    .orderBy(desc(sql`SUM(${templateMetricsDaily.executionsStarted})`));

  return results.map(r => ({
    templateId: r.templateId,
    templateName: r.templateName,
    executions: r.executions,
    responseRate: r.executions > 0 ? (r.responded / r.executions) * 100 : 0,
    conversionRate: r.executions > 0 ? (r.conversions / r.executions) * 100 : 0,
    optOutRate: r.executions > 0 ? (r.optOuts / r.executions) * 100 : 0,
  }));
}

/**
 * Get simple outcomes for a client (what they see)
 */
export async function getClientOutcomes(
  clientId: string,
  period?: string // '2024-01' or undefined for current month
): Promise<{
  period: string;
  missedCallsRecovered: { contacted: number; responded: number; rate: number };
  estimateFollowUps: { sent: number; converted: number; rate: number };
  paymentReminders: { sent: number; collected: number; amount: number };
  reviewRequests: { sent: number; received: number; rate: number };
}> {
  const targetPeriod = period || format(new Date(), 'yyyy-MM');
  
  // Get outcomes grouped by flow category
  const outcomes = await db
    .select({
      category: flows.category,
      contacted: sql<number>`SUM(${clientFlowOutcomes.leadsContacted})`,
      responded: sql<number>`SUM(${clientFlowOutcomes.leadsResponded})`,
      conversions: sql<number>`SUM(${clientFlowOutcomes.conversions})`,
      revenue: sql<number>`SUM(${clientFlowOutcomes.revenue})`,
    })
    .from(clientFlowOutcomes)
    .innerJoin(flows, eq(clientFlowOutcomes.flowId, flows.id))
    .where(
      and(
        eq(clientFlowOutcomes.clientId, clientId),
        eq(clientFlowOutcomes.period, targetPeriod)
      )
    )
    .groupBy(flows.category);

  const byCategory = Object.fromEntries(
    outcomes.map(o => [o.category, o])
  );

  const missedCall = byCategory['missed_call'] || { contacted: 0, responded: 0 };
  const estimate = byCategory['estimate'] || { contacted: 0, conversions: 0 };
  const payment = byCategory['payment'] || { contacted: 0, conversions: 0, revenue: 0 };
  const review = byCategory['review'] || { contacted: 0, conversions: 0 };

  return {
    period: targetPeriod,
    missedCallsRecovered: {
      contacted: missedCall.contacted || 0,
      responded: missedCall.responded || 0,
      rate: missedCall.contacted > 0 
        ? ((missedCall.responded || 0) / missedCall.contacted) * 100 
        : 0,
    },
    estimateFollowUps: {
      sent: estimate.contacted || 0,
      converted: estimate.conversions || 0,
      rate: estimate.contacted > 0 
        ? ((estimate.conversions || 0) / estimate.contacted) * 100 
        : 0,
    },
    paymentReminders: {
      sent: payment.contacted || 0,
      collected: payment.conversions || 0,
      amount: payment.revenue || 0,
    },
    reviewRequests: {
      sent: review.contacted || 0,
      received: review.conversions || 0,
      rate: review.contacted > 0 
        ? ((review.conversions || 0) / review.contacted) * 100 
        : 0,
    },
  };
}

/**
 * Update client outcomes (called by cron or on conversion)
 */
export async function updateClientOutcomes(
  clientId: string,
  flowId: string,
  period: string,
  updates: {
    leadsContacted?: number;
    leadsResponded?: number;
    conversions?: number;
    revenue?: number;
  }
): Promise<void> {
  await db
    .insert(clientFlowOutcomes)
    .values({
      clientId,
      flowId,
      period,
      ...updates,
    })
    .onConflictDoUpdate({
      target: [clientFlowOutcomes.clientId, clientFlowOutcomes.flowId, clientFlowOutcomes.period],
      set: {
        leadsContacted: updates.leadsContacted 
          ? sql`${clientFlowOutcomes.leadsContacted} + ${updates.leadsContacted}`
          : clientFlowOutcomes.leadsContacted,
        leadsResponded: updates.leadsResponded
          ? sql`${clientFlowOutcomes.leadsResponded} + ${updates.leadsResponded}`
          : clientFlowOutcomes.leadsResponded,
        conversions: updates.conversions
          ? sql`${clientFlowOutcomes.conversions} + ${updates.conversions}`
          : clientFlowOutcomes.conversions,
        revenue: updates.revenue
          ? sql`${clientFlowOutcomes.revenue} + ${updates.revenue}`
          : clientFlowOutcomes.revenue,
      },
    });
}
```

---

## Step 3: Admin Template Comparison Dashboard

**CREATE** `src/app/admin/analytics/page.tsx`:

```typescript
import { Suspense } from 'react';
import { db } from '@/lib/db';
import { flowTemplates } from '@/lib/db/schema';
import { TemplateComparison } from '@/components/analytics/template-comparison';
import { CategoryPerformance } from '@/components/analytics/category-performance';

export default async function AnalyticsPage() {
  const categories = await db
    .selectDistinct({ category: flowTemplates.category })
    .from(flowTemplates);

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Template Analytics</h1>
        <p className="text-muted-foreground">
          Aggregate performance across all clients
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        {categories.map(({ category }) => (
          <CategoryPerformance key={category} category={category!} />
        ))}
      </Suspense>
    </div>
  );
}
```

**CREATE** `src/components/analytics/category-performance.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Crown,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface TemplateStats {
  templateId: string;
  templateName: string;
  executions: number;
  responseRate: number;
  conversionRate: number;
  optOutRate: number;
}

interface CategoryPerformanceProps {
  category: string;
}

const categoryLabels: Record<string, string> = {
  estimate: 'Estimate Follow-up',
  payment: 'Payment Reminders',
  review: 'Review Requests',
  referral: 'Referral Requests',
  appointment: 'Appointment Reminders',
  missed_call: 'Missed Call Recovery',
  form_response: 'Form Response',
  custom: 'Custom Flows',
};

export function CategoryPerformance({ category }: CategoryPerformanceProps) {
  const [templates, setTemplates] = useState<TemplateStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/admin/analytics/templates?category=${category}&days=${days}`)
      .then(r => r.json())
      .then(data => {
        setTemplates(data);
        setLoading(false);
      });
  }, [category, days]);

  if (loading) {
    return <Card><CardContent className="py-8 text-center">Loading...</CardContent></Card>;
  }

  if (templates.length === 0) {
    return null;
  }

  // Find best performer
  const bestPerformer = templates.reduce((best, t) => 
    t.conversionRate > best.conversionRate ? t : best
  , templates[0]);

  const totalExecutions = templates.reduce((sum, t) => sum + t.executions, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{categoryLabels[category] || category}</CardTitle>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <Button
                key={d}
                variant={days === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {totalExecutions < 100 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            ⚠️ Low volume ({totalExecutions} executions). Results may not be statistically significant.
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead className="text-right">Executions</TableHead>
              <TableHead className="text-right">Response Rate</TableHead>
              <TableHead className="text-right">Conversion Rate</TableHead>
              <TableHead className="text-right">Opt-out Rate</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => {
              const isBest = template.templateId === bestPerformer.templateId && totalExecutions >= 100;
              
              return (
                <TableRow key={template.templateId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isBest && <Crown className="h-4 w-4 text-yellow-500" />}
                      <span className="font-medium">{template.templateName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {template.executions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={template.responseRate} baseline={30} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={template.conversionRate} baseline={10} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={template.optOutRate} baseline={2} inverse />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/templates/${template.templateId}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {totalExecutions >= 100 && templates.length > 1 && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <Crown className="h-5 w-5" />
              <span className="font-medium">
                "{bestPerformer.templateName}" is performing best
              </span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              {bestPerformer.conversionRate.toFixed(1)}% conversion rate vs category average of{' '}
              {(templates.reduce((s, t) => s + t.conversionRate, 0) / templates.length).toFixed(1)}%
            </p>
            <Button size="sm" className="mt-2" asChild>
              <Link href={`/admin/templates/${bestPerformer.templateId}/push`}>
                Roll out to more clients
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({ 
  value, 
  baseline, 
  inverse = false 
}: { 
  value: number; 
  baseline: number; 
  inverse?: boolean;
}) {
  const isGood = inverse ? value < baseline : value > baseline;
  const isBad = inverse ? value > baseline * 1.5 : value < baseline * 0.5;
  
  return (
    <div className="flex items-center justify-end gap-1">
      <span className={isBad ? 'text-red-600' : isGood ? 'text-green-600' : ''}>
        {value.toFixed(1)}%
      </span>
      {isGood && !inverse && <TrendingUp className="h-3 w-3 text-green-500" />}
      {isBad && <TrendingDown className="h-3 w-3 text-red-500" />}
    </div>
  );
}
```

---

## Step 4: Template Detail Analytics

**CREATE** `src/components/analytics/template-detail-stats.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface TemplateDetailStatsProps {
  templateId: string;
}

interface StepPerformance {
  stepNumber: number;
  sent: number;
  responseRate: number;
}

interface TemplateStats {
  executions: number;
  completionRate: number;
  responseRate: number;
  conversionRate: number;
  avgResponseTimeMinutes: number;
  optOutRate: number;
  totalRevenue: number;
  stepPerformance: StepPerformance[];
}

export function TemplateDetailStats({ templateId }: TemplateDetailStatsProps) {
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/analytics/templates/${templateId}`)
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, [templateId]);

  if (loading || !stats) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.executions.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Total Executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.responseRate.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Response Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.optOutRate.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Opt-out Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Step Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Response Rate by Step</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.stepPerformance}>
                <XAxis 
                  dataKey="stepNumber" 
                  tickFormatter={(v) => `Step ${v}`}
                />
                <YAxis 
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Response Rate']}
                  labelFormatter={(label) => `Step ${label}`}
                />
                <Bar 
                  dataKey="responseRate" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Shows which step triggers the most responses. High early-step response = good initial message. 
            High late-step response = persistence pays off.
          </p>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.stepPerformance.length > 0 && (
            <>
              {stats.stepPerformance[0].responseRate > 20 && (
                <div className="p-3 bg-green-50 rounded-lg text-green-800 text-sm">
                  ✓ Strong first message - {stats.stepPerformance[0].responseRate.toFixed(0)}% respond to Step 1
                </div>
              )}
              {stats.stepPerformance[0].responseRate < 10 && (
                <div className="p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                  ⚠ Low initial response - consider revising Step 1 message
                </div>
              )}
              {stats.optOutRate > 3 && (
                <div className="p-3 bg-red-50 rounded-lg text-red-800 text-sm">
                  ⚠ High opt-out rate ({stats.optOutRate.toFixed(1)}%) - messages may be too aggressive
                </div>
              )}
              {stats.conversionRate > 15 && (
                <div className="p-3 bg-green-50 rounded-lg text-green-800 text-sm">
                  ✓ Above average conversion rate - consider rolling out more widely
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 5: Client Outcomes Widget

**CREATE** `src/components/dashboard/client-outcomes.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Phone, 
  FileText, 
  DollarSign, 
  Star,
  TrendingUp,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface ClientOutcomesProps {
  clientId: string;
}

interface Outcomes {
  period: string;
  missedCallsRecovered: { contacted: number; responded: number; rate: number };
  estimateFollowUps: { sent: number; converted: number; rate: number };
  paymentReminders: { sent: number; collected: number; amount: number };
  reviewRequests: { sent: number; received: number; rate: number };
}

export function ClientOutcomes({ clientId }: ClientOutcomesProps) {
  const [outcomes, setOutcomes] = useState<Outcomes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/outcomes`)
      .then(r => r.json())
      .then(data => {
        setOutcomes(data);
        setLoading(false);
      });
  }, [clientId]);

  if (loading || !outcomes) {
    return <Card><CardContent className="py-8">Loading...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Your Results This Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Missed Calls */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-800">
              <Phone className="h-5 w-5" />
              <span className="font-medium">Missed Calls Recovered</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-blue-900">
                {outcomes.missedCallsRecovered.responded}
              </span>
              <span className="text-blue-700">
                {' '}of {outcomes.missedCallsRecovered.contacted}
              </span>
            </div>
            {outcomes.missedCallsRecovered.contacted > 0 && (
              <p className="text-sm text-blue-600 mt-1">
                {outcomes.missedCallsRecovered.rate.toFixed(0)}% recovery rate
              </p>
            )}
          </div>

          {/* Estimates */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-2 text-green-800">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Estimate Follow-ups</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-green-900">
                {outcomes.estimateFollowUps.converted}
              </span>
              <span className="text-green-700">
                {' '}converted of {outcomes.estimateFollowUps.sent} sent
              </span>
            </div>
            {outcomes.estimateFollowUps.sent > 0 && (
              <p className="text-sm text-green-600 mt-1">
                {outcomes.estimateFollowUps.rate.toFixed(0)}% close rate
              </p>
            )}
          </div>

          {/* Payments */}
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-800">
              <DollarSign className="h-5 w-5" />
              <span className="font-medium">Revenue Recovered</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-emerald-900">
                ${outcomes.paymentReminders.amount.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-emerald-600 mt-1">
              {outcomes.paymentReminders.collected} invoices collected
            </p>
          </div>

          {/* Reviews */}
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-800">
              <Star className="h-5 w-5" />
              <span className="font-medium">Reviews Received</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-yellow-900">
                {outcomes.reviewRequests.received}
              </span>
              <span className="text-yellow-700">
                {' '}of {outcomes.reviewRequests.sent} requested
              </span>
            </div>
            {outcomes.reviewRequests.sent > 0 && (
              <p className="text-sm text-yellow-600 mt-1">
                {outcomes.reviewRequests.rate.toFixed(0)}% response rate
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Step 6: Analytics API Routes

**CREATE** `src/app/api/admin/analytics/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { compareTemplates } from '@/lib/services/flow-metrics';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const days = parseInt(searchParams.get('days') || '30');

  if (!category) {
    return NextResponse.json({ error: 'Category required' }, { status: 400 });
  }

  const comparison = await compareTemplates(category, days);
  return NextResponse.json(comparison);
}
```

**CREATE** `src/app/api/admin/analytics/templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTemplatePerformance } from '@/lib/services/flow-metrics';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');

  const stats = await getTemplatePerformance(params.id, days);
  return NextResponse.json(stats);
}
```

**CREATE** `src/app/api/clients/[id]/outcomes/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientOutcomes } from '@/lib/services/flow-metrics';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || undefined;

  const outcomes = await getClientOutcomes(params.id, period);
  return NextResponse.json(outcomes);
}
```

---

## Step 7: Integrate Metrics Recording

**MODIFY** `src/lib/services/flow-execution.ts` (add to existing):

```typescript
import { 
  recordExecutionStart, 
  recordExecutionComplete, 
  recordStepMessageSent,
  recordLeadResponse,
  updateClientOutcomes,
} from './flow-metrics';
import { format } from 'date-fns';

// In startFlowExecution():
await recordExecutionStart(flowId, flow.templateId);

// In executeFlowStep() after sending message:
await recordStepMessageSent(flow.templateId, step.stepNumber);

// In completeFlowExecution():
await recordExecutionComplete(flowId, flow.templateId, converted, conversionValue);

// Update client outcomes
await updateClientOutcomes(
  flow.clientId,
  flowId,
  format(new Date(), 'yyyy-MM'),
  { leadsContacted: 1 }
);
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add metrics tables |
| `src/lib/services/flow-metrics.ts` | Created |
| `src/app/admin/analytics/page.tsx` | Created |
| `src/components/analytics/category-performance.tsx` | Created |
| `src/components/analytics/template-detail-stats.tsx` | Created |
| `src/components/dashboard/client-outcomes.tsx` | Created |
| `src/app/api/admin/analytics/templates/route.ts` | Created |
| `src/app/api/admin/analytics/templates/[id]/route.ts` | Created |
| `src/app/api/clients/[id]/outcomes/route.ts` | Created |
| `src/lib/services/flow-execution.ts` | Modified - Add metrics recording |

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Execute some flows to generate data

# 3. Check admin analytics
open http://localhost:3000/admin/analytics

# 4. Check client outcomes
open http://localhost:3000/dashboard
```

## Success Criteria
- [ ] Template metrics aggregate across all clients
- [ ] Admin can compare templates by category
- [ ] Step-level response rates visible
- [ ] "Best performer" highlighted with sufficient volume
- [ ] Low-volume warning shown
- [ ] Clients see simple outcome cards (not stats)
- [ ] No per-client A/B testing UI
