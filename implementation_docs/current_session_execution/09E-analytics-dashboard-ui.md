# Phase 40: Analytics Dashboard UI

## Prerequisites
- Phase 39 (Analytics Schema) complete
- Phase 16 (Client Dashboard) complete

## Goal
Build the analytics dashboards for:
1. Client-facing ROI dashboard (justify their $997/month)
2. Admin platform analytics (MRR, churn, health)
3. Exportable PDF/CSV reports

---

## Step 1: Create Analytics API Routes

**CREATE** `src/app/api/clients/[clientId]/analytics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientDashboardSummary } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const summary = await getClientDashboardSummary(params.clientId);
  
  return NextResponse.json(summary);
}
```

**CREATE** `src/app/api/clients/[clientId]/analytics/funnel/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversionFunnel } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || getDefaultStartDate();
  const endDate = searchParams.get('endDate') || new Date().toISOString();
  
  const funnel = await getConversionFunnel(params.clientId, startDate, endDate);
  
  return NextResponse.json(funnel);
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}
```

**CREATE** `src/app/api/clients/[clientId]/analytics/sources/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeadSourceBreakdown } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || getDefaultStartDate();
  const endDate = searchParams.get('endDate') || new Date().toISOString();
  
  const sources = await getLeadSourceBreakdown(params.clientId, startDate, endDate);
  
  return NextResponse.json(sources);
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}
```

**CREATE** `src/app/api/clients/[clientId]/analytics/monthly/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMonthlyComparison } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '6');
  
  const data = await getMonthlyComparison(params.clientId, months);
  
  return NextResponse.json(data);
}
```

---

## Step 2: Create Client Analytics Dashboard Page

**CREATE** `src/app/(dashboard)/analytics/page.tsx`:

```typescript
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics & ROI</h1>
        <p className="text-muted-foreground">
          Track your leads, conversions, and revenue
        </p>
      </div>
      
      <Suspense fallback={<div>Loading analytics...</div>}>
        <AnalyticsDashboard clientId={session.user.clientId} />
      </Suspense>
    </div>
  );
}
```

---

## Step 3: Create Analytics Dashboard Component

**CREATE** `src/components/analytics/analytics-dashboard.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  MessageSquare,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Download,
  Star,
} from 'lucide-react';
import { KpiCard } from './kpi-card';
import { ConversionFunnel } from './conversion-funnel';
import { LeadSourceChart } from './lead-source-chart';
import { RevenueChart } from './revenue-chart';
import { ResponseTimeChart } from './response-time-chart';

interface AnalyticsDashboardProps {
  clientId: string;
}

export function AnalyticsDashboard({ clientId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState('30');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [clientId]);

  const fetchSummary = async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/analytics`);
    const data = await res.json();
    setSummary(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  const monthly = summary?.monthly;
  const dailyTrend = summary?.dailyTrend || [];

  // Calculate totals from daily trend for the period
  const periodTotals = dailyTrend.reduce((acc: any, day: any) => ({
    leads: acc.leads + day.newLeads,
    appointments: acc.appointments + day.appointmentsBooked,
    jobs: acc.jobs + day.jobsWon,
    revenue: acc.revenue + day.revenueAttributedCents,
    messages: acc.messages + day.inboundMessages + day.outboundMessages,
  }), { leads: 0, appointments: 0, jobs: 0, revenue: 0, messages: 0 });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const conversionRate = periodTotals.leads > 0 
    ? ((periodTotals.jobs / periodTotals.leads) * 100).toFixed(1)
    : '0';

  const avgJobValue = periodTotals.jobs > 0
    ? formatCurrency(periodTotals.revenue / periodTotals.jobs)
    : '$0';

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="New Leads"
          value={periodTotals.leads}
          change={monthly?.previousMonthLeadsChangePct}
          icon={Users}
          description="Leads captured"
        />
        <KpiCard
          title="Appointments"
          value={periodTotals.appointments}
          icon={Calendar}
          description="Booked this period"
        />
        <KpiCard
          title="Jobs Won"
          value={periodTotals.jobs}
          icon={TrendingUp}
          description={`${conversionRate}% conversion`}
        />
        <KpiCard
          title="Revenue"
          value={formatCurrency(periodTotals.revenue)}
          change={monthly?.previousMonthRevenueChangePct}
          icon={DollarSign}
          description={`Avg job: ${avgJobValue}`}
          highlight
        />
      </div>

      {/* ROI Highlight Card */}
      {monthly && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Your ROI This Month</p>
                <p className="text-3xl font-bold text-green-800">
                  {monthly.roiMultiple ? `${monthly.roiMultiple.toFixed(1)}x` : 'Calculating...'}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {formatCurrency(monthly.revenueAttributedCents)} revenue / {formatCurrency(monthly.platformCostCents || 99700)} platform cost
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-700">Net Gain</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency((monthly.revenueAttributedCents || 0) - (monthly.platformCostCents || 99700))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
          <TabsTrigger value="sources">Lead Sources</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart data={dailyTrend} />
              </CardContent>
            </Card>

            {/* Lead Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Leads by Day</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadTrendChart data={dailyTrend} />
              </CardContent>
            </Card>
          </div>

          {/* Additional metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Messages Handled</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{periodTotals.messages}</div>
                <p className="text-xs text-muted-foreground">
                  {monthly?.aiHandledPercent || 0}% handled by AI
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatResponseTime(monthly?.avgResponseTimeSeconds)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all conversations
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">{monthly?.reviewsReceived || 0}</div>
                  {monthly?.avgRating && (
                    <div className="flex items-center text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="ml-1 text-sm">{monthly.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  New reviews this month
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversionFunnel clientId={clientId} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadSourceChart clientId={clientId} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponseTimeChart clientId={clientId} dateRange={dateRange} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>AI vs Human Responses</CardTitle>
              </CardHeader>
              <CardContent>
                <AiVsHumanChart data={dailyTrend} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatResponseTime(seconds: number | null): string {
  if (!seconds) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

// Simple chart components (would use recharts in production)
function LeadTrendChart({ data }: { data: any[] }) {
  // Simplified - use recharts AreaChart in production
  return (
    <div className="h-[200px] flex items-end gap-1">
      {data.slice(-14).map((day, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
          style={{ height: `${Math.max(20, (day.newLeads / Math.max(...data.map(d => d.newLeads || 1))) * 100)}%` }}
          title={`${day.date}: ${day.newLeads} leads`}
        />
      ))}
    </div>
  );
}

function AiVsHumanChart({ data }: { data: any[] }) {
  const totals = data.reduce((acc, day) => ({
    ai: acc.ai + (day.aiResponses || 0),
    human: acc.human + (day.humanResponses || 0),
  }), { ai: 0, human: 0 });
  
  const total = totals.ai + totals.human || 1;
  const aiPercent = Math.round((totals.ai / total) * 100);
  
  return (
    <div className="space-y-4">
      <div className="flex h-4 rounded-full overflow-hidden">
        <div 
          className="bg-primary" 
          style={{ width: `${aiPercent}%` }}
        />
        <div 
          className="bg-muted" 
          style={{ width: `${100 - aiPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <div>
          <span className="font-medium">{aiPercent}%</span> AI ({totals.ai})
        </div>
        <div>
          <span className="font-medium">{100 - aiPercent}%</span> Human ({totals.human})
        </div>
      </div>
    </div>
  );
}
```

---

## Step 4: Create KPI Card Component

**CREATE** `src/components/analytics/kpi-card.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number | null;
  icon: LucideIcon;
  description?: string;
  highlight?: boolean;
}

export function KpiCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  description,
  highlight,
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className={cn(highlight && 'border-primary bg-primary/5')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn('h-4 w-4', highlight ? 'text-primary' : 'text-muted-foreground')} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {change !== null && change !== undefined && (
            <span className={cn(
              'flex items-center text-xs font-medium',
              isPositive && 'text-green-600',
              isNegative && 'text-red-600',
              !isPositive && !isNegative && 'text-muted-foreground'
            )}>
              {isPositive && <TrendingUp className="h-3 w-3 mr-1" />}
              {isNegative && <TrendingDown className="h-3 w-3 mr-1" />}
              {isPositive && '+'}
              {change}%
            </span>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Step 5: Create Conversion Funnel Component

**CREATE** `src/components/analytics/conversion-funnel.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';

interface ConversionFunnelProps {
  clientId: string;
  dateRange: string;
}

interface FunnelStage {
  stage: string;
  count: number;
  value: number;
  conversionRate: number;
}

const stageLabels: Record<string, string> = {
  lead_created: 'Leads Captured',
  first_response: 'First Response',
  qualified: 'Qualified',
  appointment_booked: 'Appointments Booked',
  quote_sent: 'Quotes Sent',
  job_won: 'Jobs Won',
};

export function ConversionFunnel({ clientId, dateRange }: ConversionFunnelProps) {
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunnel();
  }, [clientId, dateRange]);

  const fetchFunnel = async () => {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));
    
    const res = await fetch(
      `/api/clients/${clientId}/analytics/funnel?startDate=${startDate.toISOString()}`
    );
    const data = await res.json();
    setFunnel(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading funnel...</div>;
  }

  const maxCount = Math.max(...funnel.map(s => s.count), 1);

  return (
    <div className="space-y-4">
      {funnel.map((stage, index) => {
        const widthPercent = (stage.count / maxCount) * 100;
        
        return (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{stageLabels[stage.stage] || stage.stage}</span>
              <span className="text-muted-foreground">{stage.count}</span>
            </div>
            
            <div className="relative">
              <div className="h-10 bg-muted rounded-lg overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 flex items-center justify-end pr-3"
                  style={{ width: `${Math.max(widthPercent, 10)}%` }}
                >
                  {stage.value > 0 && (
                    <span className="text-xs text-primary-foreground font-medium">
                      ${(stage.value / 100).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {index < funnel.length - 1 && (
              <div className="flex items-center justify-center py-2">
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">
                  {stage.conversionRate}% conversion
                </span>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Overall conversion summary */}
      {funnel.length > 1 && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall Lead → Job Conversion</span>
            <span className="text-lg font-bold text-primary">
              {funnel[0]?.count > 0 
                ? ((funnel[funnel.length - 1]?.count / funnel[0].count) * 100).toFixed(1)
                : 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Step 6: Create Lead Source Chart

**CREATE** `src/components/analytics/lead-source-chart.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { 
  Phone, 
  Globe, 
  Users, 
  MoreHorizontal,
} from 'lucide-react';

interface LeadSourceChartProps {
  clientId: string;
  dateRange: string;
}

interface SourceData {
  source: string;
  leads: number;
  conversions: number;
  revenue: number;
}

const sourceIcons: Record<string, any> = {
  missed_call: Phone,
  web_form: Globe,
  referral: Users,
};

const sourceLabels: Record<string, string> = {
  missed_call: 'Missed Calls',
  web_form: 'Web Forms',
  referral: 'Referrals',
};

export function LeadSourceChart({ clientId, dateRange }: LeadSourceChartProps) {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources();
  }, [clientId, dateRange]);

  const fetchSources = async () => {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));
    
    const res = await fetch(
      `/api/clients/${clientId}/analytics/sources?startDate=${startDate.toISOString()}`
    );
    const data = await res.json();
    setSources(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const totalLeads = sources.reduce((sum, s) => sum + Number(s.leads), 0);

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <div className="space-y-4">
        {sources.map((source) => {
          const Icon = sourceIcons[source.source] || MoreHorizontal;
          const percent = totalLeads > 0 ? (Number(source.leads) / totalLeads) * 100 : 0;
          const conversionRate = Number(source.leads) > 0 
            ? ((Number(source.conversions) / Number(source.leads)) * 100).toFixed(1)
            : '0';
          
          return (
            <div key={source.source} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {sourceLabels[source.source] || source.source || 'Other'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{source.leads}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({percent.toFixed(0)}%)
                  </span>
                </div>
              </div>
              
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{conversionRate}% converted to jobs</span>
                <span>${((Number(source.revenue) || 0) / 100).toLocaleString()} revenue</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-right">Leads</th>
              <th className="px-4 py-2 text-right">Conversions</th>
              <th className="px-4 py-2 text-right">Revenue</th>
              <th className="px-4 py-2 text-right">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.source} className="border-t">
                <td className="px-4 py-2">
                  {sourceLabels[source.source] || source.source || 'Other'}
                </td>
                <td className="px-4 py-2 text-right">{source.leads}</td>
                <td className="px-4 py-2 text-right">{source.conversions}</td>
                <td className="px-4 py-2 text-right">
                  ${((Number(source.revenue) || 0) / 100).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {Number(source.leads) > 0 
                    ? ((Number(source.conversions) / Number(source.leads)) * 100).toFixed(1)
                    : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Step 7: Create Revenue Chart Component

**CREATE** `src/components/analytics/revenue-chart.tsx`:

```typescript
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenueAttributedCents: number;
    paymentsCollectedCents: number;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data.map(d => ({
    date: d.date,
    revenue: d.revenueAttributedCents / 100,
    payments: d.paymentsCollectedCents / 100,
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(parseISO(value), 'MMM d')}
            fontSize={12}
          />
          <YAxis 
            tickFormatter={(value) => `$${value}`}
            fontSize={12}
          />
          <Tooltip 
            formatter={(value: number) => [`$${value.toFixed(0)}`, '']}
            labelFormatter={(label) => format(parseISO(label), 'MMM d, yyyy')}
          />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            stroke="#2563eb" 
            strokeWidth={2}
            name="Revenue"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="payments" 
            stroke="#16a34a" 
            strokeWidth={2}
            name="Payments"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Step 8: Create Response Time Chart

**CREATE** `src/components/analytics/response-time-chart.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getResponseTimeDistribution } from '@/lib/services/analytics-queries';

interface ResponseTimeChartProps {
  clientId: string;
  dateRange: string;
}

export function ResponseTimeChart({ clientId, dateRange }: ResponseTimeChartProps) {
  const [distribution, setDistribution] = useState<Array<{ bucket: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDistribution();
  }, [clientId, dateRange]);

  const fetchDistribution = async () => {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));
    
    const res = await fetch(
      `/api/clients/${clientId}/analytics/response-time?startDate=${startDate.toISOString()}`
    );
    const data = await res.json();
    setDistribution(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const total = distribution.reduce((sum, d) => sum + Number(d.count), 0);
  
  const bucketOrder = ['Under 1 min', '1-5 min', '5-15 min', '15-60 min', 'Over 1 hour'];
  const sortedData = bucketOrder.map(bucket => 
    distribution.find(d => d.bucket === bucket) || { bucket, count: 0 }
  );

  const bucketColors: Record<string, string> = {
    'Under 1 min': 'bg-green-500',
    '1-5 min': 'bg-green-400',
    '5-15 min': 'bg-yellow-400',
    '15-60 min': 'bg-orange-400',
    'Over 1 hour': 'bg-red-400',
  };

  return (
    <div className="space-y-4">
      {sortedData.map((item) => {
        const percent = total > 0 ? (Number(item.count) / total) * 100 : 0;
        
        return (
          <div key={item.bucket} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{item.bucket}</span>
              <span className="text-muted-foreground">
                {item.count} ({percent.toFixed(0)}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${bucketColors[item.bucket]} transition-all duration-500`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
      
      {/* Target indicator */}
      <div className="mt-4 p-3 bg-muted rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span>Responses under 5 minutes</span>
          <span className="font-bold">
            {total > 0 
              ? (((sortedData[0]?.count || 0) + (sortedData[1]?.count || 0)) / total * 100).toFixed(0)
              : 0}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Industry benchmark: 78% under 5 minutes
        </p>
      </div>
    </div>
  );
}
```

---

## Step 9: Create Admin Platform Analytics Page

**CREATE** `src/app/(admin)/admin/analytics/page.tsx`:

```typescript
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PlatformAnalytics } from '@/components/admin/platform-analytics';

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/login');
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground">
          MRR, churn, and platform health metrics
        </p>
      </div>
      
      <Suspense fallback={<div>Loading...</div>}>
        <PlatformAnalytics />
      </Suspense>
    </div>
  );
}
```

**CREATE** `src/components/admin/platform-analytics.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

export function PlatformAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await fetch('/api/admin/analytics');
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-12">Loading platform analytics...</div>;
  }

  const formatCurrency = (cents: number) => 
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);

  return (
    <div className="space-y-6">
      {/* MRR Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.mrrCents || 0)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeClients || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{data?.newClients || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churned</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{data?.churnedClients || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Usage & Costs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Platform Usage Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Total Messages</span>
              <span className="font-bold">{data?.totalMessages?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>AI Responses</span>
              <span className="font-bold">{data?.totalAiResponses?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Escalations</span>
              <span className="font-bold">{data?.totalEscalations || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>New Leads</span>
              <span className="font-bold">{data?.totalLeads || 0}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>API Costs (MTD)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-bold">{formatCurrency(data?.totalApiCostsCents || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg per Client</span>
              <span className="font-bold">{formatCurrency(data?.avgCostPerClientCents || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gross Margin</span>
              <span className="font-bold text-green-600">
                {data?.mrrCents && data?.totalApiCostsCents
                  ? (((data.mrrCents - data.totalApiCostsCents) / data.mrrCents) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Health Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Avg Client Satisfaction</span>
              <span className="font-bold">{data?.avgClientSatisfaction?.toFixed(1) || 'N/A'}/5</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Churn Rate</span>
              <span className={`font-bold ${(data?.churnRate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                {data?.churnRate?.toFixed(1) || 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 10: Create Report Export API

**CREATE** `src/app/api/clients/[clientId]/analytics/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyticsMonthly, clients } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const months = parseInt(searchParams.get('months') || '12');
  
  // Get client info
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.clientId))
    .limit(1);
  
  // Get monthly data
  const data = await db
    .select()
    .from(analyticsMonthly)
    .where(eq(analyticsMonthly.clientId, params.clientId))
    .orderBy(desc(analyticsMonthly.month))
    .limit(months);
  
  if (format === 'csv') {
    const headers = [
      'Month', 'New Leads', 'Appointments', 'Jobs Won', 'Jobs Lost',
      'Revenue', 'Payments Collected', 'Conversion Rate', 'AI Handled %',
      'Platform Cost', 'ROI Multiple'
    ];
    
    const rows = data.map(d => [
      d.month,
      d.newLeads,
      d.appointmentsBooked,
      d.jobsWon,
      d.jobsLost,
      (d.revenueAttributedCents / 100).toFixed(2),
      (d.paymentsCollectedCents / 100).toFixed(2),
      d.leadToJobRate ? (d.leadToJobRate / 100).toFixed(2) : '',
      d.aiHandledPercent || '',
      ((d.platformCostCents || 0) / 100).toFixed(2),
      d.roiMultiple?.toFixed(2) || '',
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${client?.businessName || 'analytics'}-report.csv"`,
      },
    });
  }
  
  // JSON format
  return NextResponse.json({
    client: client?.businessName,
    generatedAt: new Date().toISOString(),
    data,
  });
}
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/clients/[clientId]/analytics/route.ts` | Main analytics API |
| `src/app/api/clients/[clientId]/analytics/funnel/route.ts` | Funnel data API |
| `src/app/api/clients/[clientId]/analytics/sources/route.ts` | Lead sources API |
| `src/app/api/clients/[clientId]/analytics/monthly/route.ts` | Monthly comparison API |
| `src/app/api/clients/[clientId]/analytics/export/route.ts` | CSV/JSON export |
| `src/app/(dashboard)/analytics/page.tsx` | Client analytics page |
| `src/components/analytics/analytics-dashboard.tsx` | Main dashboard component |
| `src/components/analytics/kpi-card.tsx` | KPI card component |
| `src/components/analytics/conversion-funnel.tsx` | Funnel visualization |
| `src/components/analytics/lead-source-chart.tsx` | Source breakdown |
| `src/components/analytics/revenue-chart.tsx` | Revenue trend chart |
| `src/components/analytics/response-time-chart.tsx` | Response time distribution |
| `src/app/(admin)/admin/analytics/page.tsx` | Admin analytics page |
| `src/components/admin/platform-analytics.tsx` | Platform metrics |

---

## Verification

```bash
# 1. Visit client analytics
open http://localhost:3000/analytics

# 2. Check API responses
curl http://localhost:3000/api/clients/xxx/analytics
curl http://localhost:3000/api/clients/xxx/analytics/funnel

# 3. Export CSV
curl http://localhost:3000/api/clients/xxx/analytics/export?format=csv

# 4. Admin analytics
open http://localhost:3000/admin/analytics
```

---

## Success Criteria
- [ ] Client dashboard shows KPIs with trends
- [ ] ROI calculation displayed prominently
- [ ] Conversion funnel visualizes drop-off
- [ ] Lead sources show attribution
- [ ] Response time distribution displays
- [ ] CSV export works
- [ ] Admin sees platform-wide metrics
- [ ] Charts render correctly with recharts
