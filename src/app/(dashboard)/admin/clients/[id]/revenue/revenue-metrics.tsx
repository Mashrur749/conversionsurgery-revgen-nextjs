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
      <Card className="border-2 border-[#3D7A50] bg-[#E8F5E9]">
        <CardContent className="py-6">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-4xl font-bold text-[#3D7A50]">{roi}%</p>
              <p className="text-sm text-[#3D7A50]">Return on Investment</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#3D7A50]">{formatMoney(stats.totalWonValue)}</p>
              <p className="text-sm text-[#3D7A50]">Revenue Attributed</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#3D7A50]">{formatMoney(stats.totalPaid)}</p>
              <p className="text-sm text-[#3D7A50]">Collected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.totalLeads}</p>
            <p className="text-sm text-muted-foreground">Leads</p>
            <p className="text-xs text-muted-foreground">Total in pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.totalQuotes}</p>
            <p className="text-sm text-muted-foreground">Quoted</p>
            <p className="text-xs text-muted-foreground">{formatMoney(stats.totalQuoteValue)} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-[#3D7A50]">{stats.totalWon}</p>
            <p className="text-sm text-muted-foreground">Won</p>
            <p className="text-xs text-muted-foreground">{formatMoney(stats.totalWonValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.totalLost}</p>
            <p className="text-sm text-muted-foreground">Lost</p>
            <p className="text-xs text-muted-foreground">{stats.totalLeads > 0 ? Math.round((stats.totalLost / stats.totalLeads) * 100) : 0}% of leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Win Rate</span>
              <span className="text-2xl font-bold">{stats.conversionRate}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Average Job Value</span>
              <span className="text-2xl font-bold">{formatMoney(stats.avgJobValue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
