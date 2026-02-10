'use client';

import { useEffect, useState } from 'react';
import { Phone, Globe, Users, MoreHorizontal, LucideIcon } from 'lucide-react';

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

const sourceIcons: Record<string, LucideIcon> = {
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

    try {
      const res = await fetch(
        `/api/clients/${clientId}/analytics/sources?startDate=${startDate.toISOString()}`
      );
      const data = await res.json();
      setSources(data);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
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
          const percent =
            totalLeads > 0 ? (Number(source.leads) / totalLeads) * 100 : 0;
          const conversionRate =
            Number(source.leads) > 0
              ? (
                  (Number(source.conversions) / Number(source.leads)) *
                  100
                ).toFixed(1)
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
                <span>
                  ${((Number(source.revenue) || 0) / 100).toLocaleString()}{' '}
                  revenue
                </span>
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
                    ? (
                        (Number(source.conversions) / Number(source.leads)) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
