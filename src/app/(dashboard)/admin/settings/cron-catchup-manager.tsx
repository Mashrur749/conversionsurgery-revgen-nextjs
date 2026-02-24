'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CatchupStatus = 'idle' | 'running' | 'failed';

type JobKey = 'monthly_reset' | 'biweekly_reports';

interface JobRow {
  jobKey: JobKey;
  periodType: 'monthly' | 'biweekly';
  status: CatchupStatus;
  lastSuccessfulPeriod: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  backlogCount: number;
  oldestPendingPeriodKey: string | null;
  oldestPendingAgeHours: number | null;
  staleBacklog: boolean;
  staleAfterHours: number;
  nextPeriodKey: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
}

interface SnapshotResponse {
  success: boolean;
  snapshot: {
    generatedAt: string;
    jobs: JobRow[];
  };
}

function formatDate(value: string | null): string {
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

function formatJobLabel(jobKey: JobKey): string {
  if (jobKey === 'monthly_reset') return 'Monthly Reset';
  return 'Bi-Weekly Reports';
}

export function CronCatchupManager() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningJob, setRunningJob] = useState<JobKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cron-catchup');
      if (!res.ok) {
        throw new Error(`Failed to fetch cron catch-up status (${res.status})`);
      }

      const payload = (await res.json()) as SnapshotResponse;
      setRows(payload.snapshot.jobs);
      setGeneratedAt(payload.snapshot.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catch-up status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runJob(jobKey: JobKey) {
    setRunningJob(jobKey);
    setError(null);

    try {
      const res = await fetch('/api/admin/cron-catchup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobKey }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to run catch-up (${res.status})`);
      }

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run catch-up');
    } finally {
      setRunningJob(null);
    }
  }

  const staleCount = useMemo(
    () => rows.filter((row) => row.staleBacklog).length,
    [rows]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Cron Catch-Up Controls</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Period-bound jobs process missed windows on the next successful run.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Jobs Tracked</p>
            <p className="text-xl font-semibold">{rows.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Stale Backlogs</p>
            <p className="text-xl font-semibold">{staleCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Snapshot Time</p>
            <p className="text-sm font-medium">{formatDate(generatedAt)}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading catch-up status...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No catch-up jobs configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[#F8F9FA]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Job</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Backlog</th>
                  <th className="px-3 py-2 text-left font-medium">Last Success</th>
                  <th className="px-3 py-2 text-left font-medium">Last Run</th>
                  <th className="px-3 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badgeClass = row.status === 'failed'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : row.status === 'running'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

                  return (
                    <tr key={row.jobKey} className="border-b hover:bg-[#F8F9FA]">
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium text-foreground">{formatJobLabel(row.jobKey)}</p>
                        <p className="text-xs text-muted-foreground">{row.periodType}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                          {row.status}
                        </span>
                        {row.lastErrorMessage && (
                          <p className="text-xs text-red-600 mt-1">{row.lastErrorMessage}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">{row.backlogCount}</p>
                        {row.oldestPendingPeriodKey && (
                          <p className={`text-xs ${row.staleBacklog ? 'text-red-600' : 'text-muted-foreground'}`}>
                            oldest {row.oldestPendingPeriodKey}
                            {row.oldestPendingAgeHours !== null
                              ? ` (${row.oldestPendingAgeHours}h)`
                              : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p>{row.lastSuccessfulPeriod || 'n/a'}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(row.lastSuccessAt)}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-xs text-muted-foreground">{formatDate(row.lastRunAt)}</p>
                        {row.nextPeriodKey && (
                          <p className="text-xs text-muted-foreground mt-1">next {row.nextPeriodKey}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void runJob(row.jobKey)}
                          disabled={runningJob === row.jobKey}
                        >
                          {runningJob === row.jobKey ? 'Running...' : 'Run Catch-Up'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
