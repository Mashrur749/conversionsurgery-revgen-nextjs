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
  Calendar,
  DollarSign,
  TrendingUp,
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
    try {
      const res = await fetch(`/api/clients/${clientId}/analytics`);
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  const monthly = summary?.monthly;
  const dailyTrend = summary?.dailyTrend || [];

  // Calculate totals from daily trend for the period
  const periodTotals = dailyTrend.reduce(
    (acc: any, day: any) => ({
      leads: acc.leads + (day.newLeads || 0),
      appointments: acc.appointments + (day.appointmentsBooked || 0),
      jobs: acc.jobs + (day.jobsWon || 0),
      revenue: acc.revenue + (day.revenueAttributedCents || 0),
      messages:
        acc.messages + (day.inboundMessages || 0) + (day.outboundMessages || 0),
    }),
    { leads: 0, appointments: 0, jobs: 0, revenue: 0, messages: 0 }
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const conversionRate =
    periodTotals.leads > 0
      ? ((periodTotals.jobs / periodTotals.leads) * 100).toFixed(1)
      : '0';

  const avgJobValue =
    periodTotals.jobs > 0
      ? formatCurrency(periodTotals.revenue / periodTotals.jobs)
      : '$0';

  const handleExport = () => {
    window.open(
      `/api/clients/${clientId}/analytics/export?format=csv`,
      '_blank'
    );
  };

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

        <Button variant="outline" onClick={handleExport}>
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
                <p className="text-sm text-green-700 font-medium">
                  Your ROI This Month
                </p>
                <p className="text-3xl font-bold text-green-800">
                  {monthly.roiMultiple
                    ? `${monthly.roiMultiple.toFixed(1)}x`
                    : 'Calculating...'}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {formatCurrency(monthly.revenueAttributedCents)} revenue /{' '}
                  {formatCurrency(monthly.platformCostCents || 99700)} platform
                  cost
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-700">Net Gain</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(
                    (monthly.revenueAttributedCents || 0) -
                      (monthly.platformCostCents || 99700)
                  )}
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
                <CardTitle className="text-sm font-medium">
                  Messages Handled
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Avg Response Time
                </CardTitle>
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
                  <div className="text-2xl font-bold">
                    {monthly?.reviewsReceived || 0}
                  </div>
                  {monthly?.avgRating && (
                    <div className="flex items-center text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="ml-1 text-sm">
                        {monthly.avgRating.toFixed(1)}
                      </span>
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

function formatResponseTime(seconds: number | null | undefined): string {
  if (!seconds) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function LeadTrendChart({ data }: { data: any[] }) {
  const maxLeads = Math.max(...data.map((d) => d.newLeads || 1));
  return (
    <div className="h-[200px] flex items-end gap-1">
      {data.slice(-14).map((day, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
          style={{
            height: `${Math.max(20, ((day.newLeads || 0) / maxLeads) * 100)}%`,
          }}
          title={`${day.date}: ${day.newLeads} leads`}
        />
      ))}
    </div>
  );
}

function AiVsHumanChart({ data }: { data: any[] }) {
  const totals = data.reduce(
    (acc, day) => ({
      ai: acc.ai + (day.aiResponses || 0),
      human: acc.human + (day.humanResponses || 0),
    }),
    { ai: 0, human: 0 }
  );

  const total = totals.ai + totals.human || 1;
  const aiPercent = Math.round((totals.ai / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex h-4 rounded-full overflow-hidden">
        <div className="bg-primary" style={{ width: `${aiPercent}%` }} />
        <div className="bg-muted" style={{ width: `${100 - aiPercent}%` }} />
      </div>
      <div className="flex justify-between text-sm">
        <div>
          <span className="font-medium">{aiPercent}%</span> AI ({totals.ai})
        </div>
        <div>
          <span className="font-medium">{100 - aiPercent}%</span> Human (
          {totals.human})
        </div>
      </div>
    </div>
  );
}
