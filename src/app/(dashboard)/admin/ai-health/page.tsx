import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { aiHealthReports } from '@/db/schema';
import type { AiHealthReport } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

function formatConfidence(val: number): string {
  return val.toFixed(1);
}

function formatPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

function formatResponseTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDelta(delta: number, invert = false): { label: string; positive: boolean } {
  const isPositive = invert ? delta < 0 : delta > 0;
  const sign = delta > 0 ? '+' : '';
  return { label: `${sign}${delta.toFixed(1)}%`, positive: isPositive };
}

function DeltaBadge({ delta, invert = false }: { delta: number; invert?: boolean }) {
  const { label, positive } = formatDelta(delta, invert);
  const style = positive
    ? { backgroundColor: '#E8F5E9', color: '#3D7A50' }
    : { backgroundColor: '#FDEAE4', color: '#C15B2E' };
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded"
      style={style}
    >
      {label}
    </span>
  );
}

function AlertBadge({ severity }: { severity: 'warning' | 'critical' }) {
  if (severity === 'critical') {
    return (
      <Badge style={{ backgroundColor: '#FDEAE4', color: '#C15B2E', borderColor: '#C15B2E' }}>
        Critical
      </Badge>
    );
  }
  return (
    <Badge style={{ backgroundColor: '#FFF3E0', color: '#C15B2E', borderColor: '#D4754A' }}>
      Warning
    </Badge>
  );
}

function StatCard({
  title,
  value,
  delta,
  invertDelta = false,
  subtitle,
}: {
  title: string;
  value: string;
  delta: number;
  invertDelta?: boolean;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ color: '#1B2F26' }}>{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge delta={delta} invert={invertDelta} />
          <span className="text-xs text-muted-foreground">vs prior week</span>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default async function AiHealthPage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/login');
  }

  const db = getDb();
  const reports = await db
    .select()
    .from(aiHealthReports)
    .orderBy(desc(aiHealthReports.createdAt))
    .limit(12);

  const latest: AiHealthReport | undefined = reports[0];

  const activeAlerts = latest?.alerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'warning'
  ) ?? [];

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F26' }}>AI Health Monitor</h1>
        <p className="text-muted-foreground mt-1">
          Weekly drift detection and performance health for the AI conversation agent
        </p>
      </div>

      {!latest ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No health reports available yet. Reports are generated weekly by the cron scheduler.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Confidence Score"
              value={formatConfidence(latest.metrics.confidenceTrend.current)}
              delta={latest.metrics.confidenceTrend.delta}
              subtitle="Avg decision confidence"
            />
            <StatCard
              title="Escalation Rate"
              value={formatPercent(latest.metrics.escalationRate.current)}
              delta={latest.metrics.escalationRate.delta}
              invertDelta
              subtitle="Conversations escalated to agent"
            />
            <StatCard
              title="Avg Response Time"
              value={formatResponseTime(latest.metrics.avgResponseTimeMs.current)}
              delta={latest.metrics.avgResponseTimeMs.delta}
              invertDelta
              subtitle="End-to-end agent latency"
            />
            <StatCard
              title="Quality Tier Usage"
              value={formatPercent(latest.metrics.qualityTierUsageRate.current)}
              delta={latest.metrics.qualityTierUsageRate.delta}
              subtitle="Requests routed to Sonnet"
            />
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Output Guard Violations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: '#1B2F26' }}>
                  {formatPercent(latest.metrics.outputGuardViolationRate)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Messages blocked before send</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Win-Back Opt-Out Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: '#1B2F26' }}>
                  {formatPercent(latest.metrics.winBackOptOutRate)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Opt-outs from win-back campaigns</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">KB Fallback Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: '#1B2F26' }}>
                  {formatPercent(latest.metrics.voyageFallbackRate)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Voyage embedding fallback to ILIKE</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {activeAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All metrics within normal thresholds &mdash; no alerts this week.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activeAlerts.map((alert, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <AlertBadge severity={alert.severity} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#1B2F26' }}>{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          Threshold: {alert.threshold} &mdash; Actual: {alert.actual.toFixed(2)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Weekly Trend Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Weekly Trend &mdash; Last {reports.length} Report{reports.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#F8F9FA]">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Week of</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Confidence</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Escalation</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Resp Time</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Quality Tier</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report, i) => (
                      <tr key={report.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FA]'}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#1B2F26' }}>
                          {formatWeekLabel(new Date(report.periodStart))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatConfidence(report.metrics.confidenceTrend.current)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPercent(report.metrics.escalationRate.current)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatResponseTime(report.metrics.avgResponseTimeMs.current)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPercent(report.metrics.qualityTierUsageRate.current)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {report.alerts.length > 0 ? (
                            <span
                              className="text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: report.alerts.some((a) => a.severity === 'critical') ? '#FDEAE4' : '#FFF3E0',
                                color: '#C15B2E',
                              }}
                            >
                              {report.alerts.length} alert{report.alerts.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span
                              className="text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#E8F5E9', color: '#3D7A50' }}
                            >
                              Clean
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden divide-y">
                {reports.map((report) => (
                  <div key={report.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm" style={{ color: '#1B2F26' }}>
                        Week of {formatWeekLabel(new Date(report.periodStart))}
                      </span>
                      {report.alerts.length > 0 ? (
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: report.alerts.some((a) => a.severity === 'critical') ? '#FDEAE4' : '#FFF3E0',
                            color: '#C15B2E',
                          }}
                        >
                          {report.alerts.length} alert{report.alerts.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: '#E8F5E9', color: '#3D7A50' }}
                        >
                          Clean
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Confidence: <span className="text-foreground tabular-nums">{formatConfidence(report.metrics.confidenceTrend.current)}</span></span>
                      <span>Escalation: <span className="text-foreground tabular-nums">{formatPercent(report.metrics.escalationRate.current)}</span></span>
                      <span>Resp Time: <span className="text-foreground tabular-nums">{formatResponseTime(report.metrics.avgResponseTimeMs.current)}</span></span>
                      <span>Quality: <span className="text-foreground tabular-nums">{formatPercent(report.metrics.qualityTierUsageRate.current)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report metadata */}
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(latest.createdAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}.
            Reports run weekly via the cron scheduler.
          </p>
        </>
      )}
    </div>
  );
}
