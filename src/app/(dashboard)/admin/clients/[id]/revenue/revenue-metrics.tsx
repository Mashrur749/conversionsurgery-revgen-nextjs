'use client';

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
