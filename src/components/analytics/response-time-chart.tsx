'use client';

import { useEffect, useState } from 'react';

interface ResponseTimeChartProps {
  clientId: string;
  dateRange: string;
}

export function ResponseTimeChart({
  clientId,
  dateRange,
}: ResponseTimeChartProps) {
  const [distribution, setDistribution] = useState<
    Array<{ bucket: string; count: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDistribution();
  }, [clientId, dateRange]);

  const fetchDistribution = async () => {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    try {
      const res = await fetch(
        `/api/clients/${clientId}/analytics/response-time?startDate=${startDate.toISOString()}`
      );
      const data = await res.json();
      setDistribution(data);
    } catch (error) {
      console.error('Failed to fetch response time data:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const total = distribution.reduce((sum, d) => sum + Number(d.count), 0);

  const bucketOrder = [
    'Under 1 min',
    '1-5 min',
    '5-15 min',
    '15-60 min',
    'Over 1 hour',
  ];
  const sortedData = bucketOrder.map(
    (bucket) =>
      distribution.find((d) => d.bucket === bucket) || { bucket, count: 0 }
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
              ? (
                  (((sortedData[0]?.count || 0) + (sortedData[1]?.count || 0)) /
                    total) *
                  100
                ).toFixed(0)
              : 0}
            %
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Industry benchmark: 78% under 5 minutes
        </p>
      </div>
    </div>
  );
}
