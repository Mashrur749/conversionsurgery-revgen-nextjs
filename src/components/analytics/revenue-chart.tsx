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
  const chartData = data.map((d) => ({
    date: d.date,
    revenue: (d.revenueAttributedCents || 0) / 100,
    payments: (d.paymentsCollectedCents || 0) / 100,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No revenue data available
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              try {
                return format(parseISO(value), 'MMM d');
              } catch {
                return value;
              }
            }}
            fontSize={12}
          />
          <YAxis tickFormatter={(value) => `$${value}`} fontSize={12} />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(0)}`, '']}
            labelFormatter={(label) => {
              try {
                return format(parseISO(label), 'MMM d, yyyy');
              } catch {
                return label;
              }
            }}
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
