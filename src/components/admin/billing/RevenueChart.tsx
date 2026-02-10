'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">
            Revenue chart will populate as subscription data accumulates.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-48">
          {data.map((item) => {
            const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
            return (
              <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  ${(item.revenue / 100).toLocaleString()}
                </span>
                <div
                  className="w-full bg-primary rounded-t"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-muted-foreground">{item.month}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
