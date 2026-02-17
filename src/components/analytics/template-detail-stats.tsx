'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StepPerformance {
  stepNumber: number;
  sent: number;
  responseRate: number;
}

interface TemplateStats {
  executions: number;
  completionRate: number;
  responseRate: number;
  conversionRate: number;
  avgResponseTimeMinutes: number;
  optOutRate: number;
  totalRevenue: number;
  stepPerformance: StepPerformance[];
}

interface TemplateDetailStatsProps {
  templateId: string;
}

export function TemplateDetailStats({ templateId }: TemplateDetailStatsProps) {
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/analytics/templates/${templateId}`)
      .then((r) => r.json() as Promise<TemplateStats>)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [templateId]);

  if (loading || !stats) {
    return <div>Loading analytics...</div>;
  }

  const maxResponseRate = Math.max(
    ...stats.stepPerformance.map((s) => s.responseRate),
    1
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.executions.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Total Executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.responseRate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">Response Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.optOutRate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">Opt-out Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Step Performance */}
      {stats.stepPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Response Rate by Step</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.stepPerformance.map((step) => (
                <div key={step.stepNumber} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-16 shrink-0">
                    Step {step.stepNumber}
                  </span>
                  <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden relative">
                    <div
                      className="h-full bg-forest rounded-md transition-all"
                      style={{
                        width: `${(step.responseRate / maxResponseRate) * 100}%`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-sm font-medium">
                      {step.responseRate.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground w-24 text-right shrink-0">
                    {step.sent.toLocaleString()} sent
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Shows which step triggers the most responses. High early-step
              response = good initial message. High late-step response =
              persistence pays off.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.stepPerformance.length > 0 && (
            <>
              {stats.stepPerformance[0].responseRate > 20 && (
                <div className="p-3 bg-[#E8F5E9] rounded-lg text-[#3D7A50] text-sm">
                  Strong first message -{' '}
                  {stats.stepPerformance[0].responseRate.toFixed(0)}% respond to
                  Step 1
                </div>
              )}
              {stats.stepPerformance[0].responseRate < 10 && (
                <div className="p-3 bg-[#FFF3E0] rounded-lg text-sienna text-sm">
                  Low initial response - consider revising Step 1 message
                </div>
              )}
            </>
          )}
          {stats.optOutRate > 3 && (
            <div className="p-3 bg-[#FDEAE4] rounded-lg text-sienna text-sm">
              High opt-out rate ({stats.optOutRate.toFixed(1)}%) - messages may
              be too aggressive
            </div>
          )}
          {stats.conversionRate > 15 && (
            <div className="p-3 bg-[#E8F5E9] rounded-lg text-[#3D7A50] text-sm">
              Above average conversion rate - consider rolling out more widely
            </div>
          )}
          {stats.executions === 0 && (
            <div className="p-3 bg-[#F8F9FA] rounded-lg text-muted-foreground text-sm">
              No executions yet. Data will appear once flows start running.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
