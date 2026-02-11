'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Thermometer, Snowflake } from 'lucide-react';

/** A single temperature bucket with its count and average score. */
interface TemperatureBucket {
  temperature: string;
  count: number;
  avgScore: number;
}

/** A summarized hot lead for the priority follow-up list. */
interface HotLeadSummary {
  id: string;
  name: string | null;
  phone: string;
  score: number | null;
}

interface ScoreDistributionProps {
  distribution: TemperatureBucket[];
  hotLeads: HotLeadSummary[];
}

/**
 * Visualizes lead score distribution as a stacked bar and lists the top hot leads for priority follow-up.
 */
export function LeadScoreDistribution({
  distribution,
  hotLeads,
}: ScoreDistributionProps) {
  const hot = distribution.find(d => d.temperature === 'hot');
  const warm = distribution.find(d => d.temperature === 'warm');
  const cold = distribution.find(d => d.temperature === 'cold');
  const total = (hot?.count || 0) + (warm?.count || 0) + (cold?.count || 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Temperature</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Distribution bar */}
          {total > 0 ? (
            <div className="flex h-8 rounded-full overflow-hidden mb-4">
              {hot && hot.count > 0 && (
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(hot.count / total) * 100}%` }}
                >
                  {hot.count}
                </div>
              )}
              {warm && warm.count > 0 && (
                <div
                  className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(warm.count / total) * 100}%` }}
                >
                  {warm.count}
                </div>
              )}
              {cold && cold.count > 0 && (
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(cold.count / total) * 100}%` }}
                >
                  {cold.count}
                </div>
              )}
            </div>
          ) : (
            <div className="h-8 rounded-full bg-muted mb-4 flex items-center justify-center text-xs text-muted-foreground">
              No scored leads yet
            </div>
          )}

          {/* Legend */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <span>Hot ({hot?.count || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-yellow-500" />
              <span>Warm ({warm?.count || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-blue-500" />
              <span>Cold ({cold?.count || 0})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hot Leads List */}
      {hotLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Hot Leads - Priority Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-900/20"
                >
                  <div>
                    <p className="font-medium">{lead.name || lead.phone}</p>
                    {lead.name && (
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                    )}
                  </div>
                  <div className="text-lg font-bold text-red-600">
                    {lead.score}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
