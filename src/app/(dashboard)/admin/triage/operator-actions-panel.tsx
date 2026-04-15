'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { OperatorActionsResult, OperatorAction } from '@/lib/services/operator-actions';

// ---------------------------------------------------------------------------
// Time formatting helper
// ---------------------------------------------------------------------------

function formatTimeAgo(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Individual action row
// ---------------------------------------------------------------------------

function ActionRow({ action }: { action: OperatorAction }) {
  const isRed = action.urgency === 'red';
  const borderClass = isRed
    ? 'border-l-4 border-l-[#C15B2E]'
    : 'border-l-4 border-l-[#D4754A]';
  const Icon = isRed ? AlertTriangle : Clock;
  const iconClass = isRed ? 'text-[#C15B2E]' : 'text-[#D4754A]';

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 ${borderClass} bg-white hover:bg-muted/20 transition-colors`}
    >
      {/* Left: icon + content */}
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconClass}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{action.clientName}</span>
            <span className="text-sm text-foreground">{action.title}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{action.detail}</span>
            <span>&middot;</span>
            <span>{formatTimeAgo(action.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Right: action button */}
      <div className="shrink-0">
        <Button asChild variant="outline" size="sm">
          <Link href={action.actionUrl}>View</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile card for an action (< 640px)
// ---------------------------------------------------------------------------

function ActionCard({ action }: { action: OperatorAction }) {
  const isRed = action.urgency === 'red';
  const borderClass = isRed
    ? 'border-l-4 border-l-[#C15B2E]'
    : 'border-l-4 border-l-[#D4754A]';
  const Icon = isRed ? AlertTriangle : Clock;
  const iconClass = isRed ? 'text-[#C15B2E]' : 'text-[#D4754A]';

  return (
    <Card className={`${borderClass}`}>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconClass}`} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">{action.clientName}</div>
            <div className="text-sm">{action.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {action.detail} &middot; {formatTimeAgo(action.createdAt)}
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={action.actionUrl}>View</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ActionsSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI summary bar (3 stat cards)
// ---------------------------------------------------------------------------

export function KpiSummaryBar({
  redActions,
  clientsAtRisk,
  activeClients,
  loading,
}: {
  redActions: number;
  clientsAtRisk: number;
  activeClients: number;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Actions Due</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <div className="text-2xl font-bold text-[#C15B2E]">{redActions}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">require immediate attention</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Clients at Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#C15B2E]">{clientsAtRisk}</div>
          <p className="text-xs text-muted-foreground mt-1">health status: urgent</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#1B2F26]">{activeClients}</div>
          <p className="text-xs text-muted-foreground mt-1">currently on platform</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main operator actions panel
// ---------------------------------------------------------------------------

export function OperatorActionsPanel({
  clientsAtRisk,
  activeClients,
}: {
  clientsAtRisk: number;
  activeClients: number;
}) {
  const [data, setData] = useState<OperatorActionsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false); // set to true once we know there are red items

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/operator-actions');
      if (!res.ok) throw new Error('Failed to load operator actions');
      const json = (await res.json()) as OperatorActionsResult;
      setData(json);
      // Auto-expand if there are red items (only on first load)
      setExpanded((prev) => prev || json.summary.red > 0);
    } catch {
      setError('Unable to load operator actions. Refresh to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActions();
    const interval = setInterval(() => {
      void fetchActions();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  const redActions = data?.summary.red ?? 0;

  return (
    <>
      {/* KPI summary cards */}
      <KpiSummaryBar
        redActions={redActions}
        clientsAtRisk={clientsAtRisk}
        activeClients={activeClients}
        loading={loading}
      />

      {/* Operator Actions collapsible section */}
      <Card className="mb-6">
        {/* Header / toggle */}
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#C15B2E]" />
                <CardTitle className="text-base">Operator Actions</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                {loading ? (
                  <Skeleton className="h-5 w-32 rounded-full" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {data
                      ? `${data.summary.red} red, ${data.summary.yellow} yellow`
                      : 'No data'}
                  </span>
                )}
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </button>

        {/* Body (collapsible) */}
        {expanded && (
          <CardContent className="pt-0 pb-0 px-0">
            {loading && <ActionsSkeleton />}

            {!loading && error && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">{error}</div>
            )}

            {!loading && !error && data && data.actions.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No operator actions pending. All clear.
              </div>
            )}

            {!loading && !error && data && data.actions.length > 0 && (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block divide-y">
                  {data.actions.map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                </div>

                {/* Mobile card stack */}
                <div className="sm:hidden space-y-3 p-4">
                  {data.actions.map((action) => (
                    <ActionCard key={action.id} action={action} />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}
