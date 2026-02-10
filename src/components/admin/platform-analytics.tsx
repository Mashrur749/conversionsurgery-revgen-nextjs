'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export function PlatformAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/platform-analytics');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch platform analytics:', error);
    }
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
            <div className="text-2xl font-bold">
              {formatCurrency(data?.mrrCents || 0)}
            </div>
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
            <div className="text-2xl font-bold text-green-600">
              +{data?.newClients || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churned</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{data?.churnedClients || 0}
            </div>
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
              <span className="font-bold">
                {data?.totalMessages?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>AI Responses</span>
              <span className="font-bold">
                {data?.totalAiResponses?.toLocaleString() || 0}
              </span>
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
              <span className="font-bold">
                {formatCurrency(data?.totalApiCostsCents || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Avg per Client</span>
              <span className="font-bold">
                {formatCurrency(data?.avgCostPerClientCents || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Gross Margin</span>
              <span className="font-bold text-green-600">
                {data?.mrrCents && data?.totalApiCostsCents
                  ? (
                      ((data.mrrCents - data.totalApiCostsCents) /
                        data.mrrCents) *
                      100
                    ).toFixed(1)
                  : 0}
                %
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
              <span className="font-bold">
                {data?.avgClientSatisfaction?.toFixed(1) || 'N/A'}/5
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Churn Rate</span>
              <span
                className={`font-bold ${(data?.churnRate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}
              >
                {data?.churnRate?.toFixed(1) || 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
