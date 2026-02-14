'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ROIDashboardProps {
  metrics: {
    // Revenue
    totalPipeline: number;
    totalWonValue: number;
    serviceBreakdown: Array<{
      serviceName: string;
      leadCount: number;
      wonCount: number;
      totalPipeline: number;
      totalWonValue: number;
    }>;
    // Speed
    avgResponseTimeSeconds: number;
    previousResponseTimeMinutes: number | null;
    industryAvgMinutes: number;
    speedMultiplier: number | null;
    improvementVsPrevious: string | null;
    // Activity
    missedCallsCaptured: number;
    appointmentsBooked: number;
    leadsReengaged: number;
    // Monthly
    monthlyInvestment: number;
    roiMultiplier: number;
    pipelineChange: number; // percent change vs previous period
  };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatSeconds(seconds: number): string {
  if (seconds === 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)}h`;
}

export function ROIDashboard({ metrics }: ROIDashboardProps) {
  return (
    <div className="space-y-4">
      {/* Hero stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-green-700">Revenue Pipeline</p>
            <p className="text-3xl font-bold text-green-900">
              {formatCents(metrics.totalPipeline)}
            </p>
            <p className="text-sm text-green-600 mt-1">
              {metrics.totalWonValue > 0 && (
                <span>{formatCents(metrics.totalWonValue)} confirmed</span>
              )}
              {metrics.pipelineChange !== 0 && (
                <span className="ml-2">
                  {metrics.pipelineChange > 0 ? '↑' : '↓'} {Math.abs(metrics.pipelineChange)}% vs last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-blue-700">Response Time</p>
            <p className="text-3xl font-bold text-blue-900">
              {formatSeconds(metrics.avgResponseTimeSeconds)}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              {metrics.speedMultiplier && metrics.speedMultiplier > 1 ? (
                <span>{metrics.speedMultiplier}x faster than industry avg ({metrics.industryAvgMinutes} min)</span>
              ) : (
                <span>Industry avg: {metrics.industryAvgMinutes} min</span>
              )}
            </p>
            {metrics.improvementVsPrevious && (
              <p className="text-xs text-blue-500 mt-0.5">
                Before CS: {metrics.improvementVsPrevious}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Missed Calls Captured</p>
            <p className="text-2xl font-bold">{metrics.missedCallsCaptured}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Appointments Booked</p>
            <p className="text-2xl font-bold">{metrics.appointmentsBooked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Leads Re-engaged</p>
            <p className="text-2xl font-bold">{metrics.leadsReengaged}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">ROI</p>
            <p className="text-2xl font-bold">
              {metrics.roiMultiplier > 0 ? `${metrics.roiMultiplier}x` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCents(metrics.monthlyInvestment * 100)} invested
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Service breakdown */}
      {metrics.serviceBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.serviceBreakdown.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.serviceName}</span>
                    <span className="text-muted-foreground">
                      {s.leadCount} leads, {s.wonCount} won
                    </span>
                  </div>
                  <span className="font-medium">{formatCents(s.totalPipeline)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
