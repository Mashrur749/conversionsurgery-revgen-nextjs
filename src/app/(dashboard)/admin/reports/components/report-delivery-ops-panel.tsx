'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';

type DeliveryView = 'all' | 'failed' | 'pending_retry' | 'terminal' | 'sent';

interface OpsRow {
  id: string;
  clientBusinessName: string | null;
  reportId: string | null;
  reportTitle: string | null;
  periodStart: string;
  periodEnd: string;
  state: string;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  retryReason: string;
  nextRetryAt: string | null;
  canRetryNow: boolean;
  isTerminal: boolean;
  lastStateAt: string;
}

interface OpsResponse {
  success: boolean;
  view: DeliveryView;
  summary: {
    total: number;
    sent: number;
    failed: number;
    pendingRetry: number;
    terminal: number;
  };
  rows: OpsRow[];
}

const VIEW_OPTIONS: Array<{ value: DeliveryView; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending_retry', label: 'Pending Retry' },
  { value: 'failed', label: 'Failed' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'sent', label: 'Sent' },
];

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

function stateBadge(row: OpsRow): { label: string; className: string } {
  if (row.isTerminal) {
    return {
      label: 'terminal',
      className: 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20',
    };
  }
  if (row.state === 'sent') {
    return {
      label: 'sent',
      className: 'bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/20',
    };
  }
  if (row.retryReason === 'backoff_pending') {
    return {
      label: 'backoff',
      className: 'bg-[#FFF3E0] text-[#C15B2E] border-[#C15B2E]/20',
    };
  }
  if (row.state === 'failed') {
    return {
      label: 'failed',
      className: 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20',
    };
  }
  return {
    label: row.state,
    className: 'bg-muted text-muted-foreground border-muted',
  };
}

export default function ReportDeliveryOpsPanel() {
  const [view, setView] = useState<DeliveryView>('pending_retry');
  const [data, setData] = useState<OpsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRetryId, setActiveRetryId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load(nextView: DeliveryView) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/deliveries?view=${nextView}&limit=120`);
      if (!res.ok) {
        throw new Error(`Failed to load delivery panel (${res.status})`);
      }
      const payload = (await res.json()) as OpsResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report delivery panel');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load(view);
    });
  }, [view]);

  async function retryDelivery(deliveryId: string) {
    setActiveRetryId(deliveryId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
      });

      if (!res.ok) {
        const payload = (await res
          .json()
          .catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Retry failed (${res.status})`);
      }

      await load(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setActiveRetryId(null);
    }
  }

  const summary = useMemo(
    () =>
      data?.summary ?? {
        total: 0,
        sent: 0,
        failed: 0,
        pendingRetry: 0,
        terminal: 0,
      },
    [data]
  );

  return (
    <div className="bg-white rounded-lg border p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Report Delivery Operations
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor failed/backoff/terminal report deliveries and trigger manual retries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="delivery-view" className="text-sm text-muted-foreground">
            View
          </label>
          <select
            id="delivery-view"
            value={view}
            onChange={(event) => setView(event.target.value as DeliveryView)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={isPending}
          >
            {VIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Pending Retry</p>
          <p className="text-xl font-semibold">{summary.pendingRetry}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-xl font-semibold">{summary.failed}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Terminal</p>
          <p className="text-xl font-semibold">{summary.terminal}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Sent</p>
          <p className="text-xl font-semibold">{summary.sent}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-[#C15B2E]/20 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8">Loading delivery rows...</div>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <div className="text-sm text-muted-foreground py-8">
          No report deliveries in this view.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-[#F8F9FA]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Client</th>
                <th className="px-3 py-2 text-left font-medium">Period</th>
                <th className="px-3 py-2 text-left font-medium">State</th>
                <th className="px-3 py-2 text-left font-medium">Attempts</th>
                <th className="px-3 py-2 text-left font-medium">Next Retry</th>
                <th className="px-3 py-2 text-left font-medium">Last Error</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => {
                const badge = stateBadge(row);
                const canRetry =
                  row.state === 'failed' && activeRetryId !== row.id;
                return (
                  <tr key={row.id} className="border-b hover:bg-[#F8F9FA]">
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">
                        {row.clientBusinessName || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.reportTitle || row.reportId || row.id}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.periodStart} to {row.periodEnd}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        updated {formatDate(row.lastStateAt)}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">{row.attemptCount}</td>
                    <td className="px-3 py-3 align-top">
                      {formatDate(row.nextRetryAt)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="text-xs">
                        {row.lastErrorCode || row.lastErrorMessage || 'n/a'}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      <Button
                        size="sm"
                        variant={row.isTerminal ? 'default' : 'outline'}
                        disabled={!canRetry}
                        onClick={() => retryDelivery(row.id)}
                      >
                        {activeRetryId === row.id ? 'Retrying...' : 'Retry now'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
