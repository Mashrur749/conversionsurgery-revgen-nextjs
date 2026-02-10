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

    try {
      const res = await fetch(
        `/api/clients/${clientId}/analytics/funnel?startDate=${startDate.toISOString()}`
      );
      const data = (await res.json()) as FunnelStage[];
      setFunnel(data);
    } catch (error) {
      console.error('Failed to fetch funnel:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading funnel...</div>;
  }

  const maxCount = Math.max(...funnel.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      {funnel.map((stage, index) => {
        const widthPercent = (stage.count / maxCount) * 100;

        return (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {stageLabels[stage.stage] || stage.stage}
              </span>
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
            <span className="font-medium">Overall Lead &rarr; Job Conversion</span>
            <span className="text-lg font-bold text-primary">
              {funnel[0]?.count > 0
                ? (
                    (funnel[funnel.length - 1]?.count / funnel[0].count) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
