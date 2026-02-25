'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReliabilitySummaryResponse {
  success: boolean;
  summary: {
    generatedAt: string;
    failedCronJobs: Array<{
      jobKey: string;
      status: string;
      backlogCount: number;
      lastErrorAt: string | null;
      lastErrorMessage: string | null;
    }>;
    webhookFailures24h: {
      total: number;
      byEventType: Array<{ eventType: string; count: number }>;
    };
    openEscalations: {
      pending: number;
      assigned: number;
      inProgress: number;
      slaBreaches: number;
    };
    reportDelivery: {
      failedTotal: number;
      failed24h: number;
      queuedRetries: number;
    };
    errorLog: {
      unresolvedTotal: number;
      created24h: number;
      topSources24h: Array<{ source: string; count: number }>;
    };
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCronJobLabel(jobKey: string): string {
  if (jobKey === 'monthly_reset') return 'Monthly reset';
  if (jobKey === 'biweekly_reports') return 'Bi-weekly reports';
  return jobKey;
}

export function ReliabilityDashboard() {
  const [summary, setSummary] = useState<ReliabilitySummaryResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/reliability/summary');
      if (!response.ok) {
        throw new Error(`Failed to load reliability summary (${response.status})`);
      }
      const payload = (await response.json()) as ReliabilitySummaryResponse;
      setSummary(payload.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reliability summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Solo Reliability Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            High-signal health view for solo operations (runtime, delivery, escalation).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading || !summary ? (
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading reliability snapshot...' : 'No data available.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Failed/Stale Cron Jobs</p>
                <p className="text-xl font-semibold">{summary.failedCronJobs.length}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Webhook Failures (24h)</p>
                <p className="text-xl font-semibold">{summary.webhookFailures24h.total}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Open Escalations</p>
                <p className="text-xl font-semibold">
                  {summary.openEscalations.pending + summary.openEscalations.assigned + summary.openEscalations.inProgress}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Report Failures</p>
                <p className="text-xl font-semibold">{summary.reportDelivery.failedTotal}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Unresolved Internal Errors</p>
                <p className="text-xl font-semibold">{summary.errorLog.unresolvedTotal}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-md border p-3">
                <p className="text-sm font-medium">Cron Risks</p>
                {summary.failedCronJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">No failed/stale cron jobs.</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {summary.failedCronJobs.map((job) => (
                      <div key={job.jobKey} className="rounded border px-2 py-2 text-xs">
                        <p className="font-medium">{formatCronJobLabel(job.jobKey)}</p>
                        <p className="text-muted-foreground">status: {job.status}</p>
                        <p className="text-muted-foreground">backlog: {job.backlogCount}</p>
                        <p className="text-muted-foreground">last error: {formatDateTime(job.lastErrorAt)}</p>
                        {job.lastErrorMessage && (
                          <p className="text-red-600 mt-1">{job.lastErrorMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <p className="text-sm font-medium">Top Error Sources (24h)</p>
                {summary.errorLog.topSources24h.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">No error-log entries in last 24h.</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {summary.errorLog.topSources24h.map((source) => (
                      <div key={source.source} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                        <span className="font-mono">{source.source}</span>
                        <span className="font-semibold">{source.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
              <div className="rounded-md border p-3">
                <p className="font-medium mb-1">Escalation Detail</p>
                <p>pending: {summary.openEscalations.pending}</p>
                <p>assigned: {summary.openEscalations.assigned}</p>
                <p>in_progress: {summary.openEscalations.inProgress}</p>
                <p className="text-red-600">sla_breaches: {summary.openEscalations.slaBreaches}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="font-medium mb-1">Report Delivery Detail</p>
                <p>failed_total: {summary.reportDelivery.failedTotal}</p>
                <p>failed_24h: {summary.reportDelivery.failed24h}</p>
                <p>queued_retries: {summary.reportDelivery.queuedRetries}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="font-medium mb-1">Webhook Failure Types (24h)</p>
                {summary.webhookFailures24h.byEventType.length === 0 ? (
                  <p className="text-muted-foreground">none</p>
                ) : (
                  summary.webhookFailures24h.byEventType.map((row) => (
                    <p key={row.eventType}>
                      {row.eventType || 'unknown'}: {row.count}
                    </p>
                  ))
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Snapshot generated: {formatDateTime(summary.generatedAt)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
