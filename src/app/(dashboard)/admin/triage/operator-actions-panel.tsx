'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { OperatorActionsResult, OperatorAction } from '@/lib/services/operator-actions';

// ---------------------------------------------------------------------------
// Capacity data type (mirrors CapacityEstimate from capacity-tracking service)
// ---------------------------------------------------------------------------

interface CapacityData {
  utilizationPercent: number;
  alertLevel: string;
  smartAssistQueueDepth: number;
}

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
// Health badge dot (derived from operator actions summary)
// ---------------------------------------------------------------------------

function HealthBadge({ red, yellow }: { red: number; yellow: number }) {
  const color =
    red > 0 ? '#C15B2E' : yellow > 0 ? '#6B7E54' : '#3D7A50';
  const label =
    red > 0 ? 'Urgent' : yellow > 0 ? 'Warning' : 'Healthy';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      title={`Overall health: ${label}`}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span style={{ color }}>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI summary bar (4 stat cards)
// ---------------------------------------------------------------------------

export function KpiSummaryBar({
  redActions,
  yellowActions,
  clientsAtRisk,
  activeClients,
  capacityData,
  loading,
  capacityLoading,
}: {
  redActions: number;
  yellowActions: number;
  clientsAtRisk: number;
  activeClients: number;
  capacityData: CapacityData | null;
  loading: boolean;
  capacityLoading: boolean;
}) {
  // Capacity color by alert level
  const capacityColor =
    capacityData?.alertLevel === 'red'
      ? '#C15B2E'
      : capacityData?.alertLevel === 'yellow'
        ? '#6B7E54'
        : '#3D7A50';

  return (
    <div className="space-y-3 mb-6">
      {/* Health badge row */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Operator Cockpit</span>
        {!loading && (
          <HealthBadge red={redActions} yellow={yellowActions} />
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

        <Card className="hover:bg-muted/20 transition-colors">
          <Link href="/admin/system-health" className="block h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              {capacityLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : capacityData ? (
                <>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: capacityColor }}
                  >
                    {capacityData.utilizationPercent}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">weekly hours utilized</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SA queue: {capacityData.smartAssistQueueDepth}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">&mdash;</div>
                  <p className="text-xs text-muted-foreground mt-1">weekly hours utilized</p>
                </>
              )}
            </CardContent>
          </Link>
        </Card>
      </div>
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
  const [capacityData, setCapacityData] = useState<CapacityData | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'red' | 'yellow'>('all');

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

  const fetchCapacity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/capacity');
      if (!res.ok) throw new Error('Failed to load capacity');
      const json = (await res.json()) as CapacityData;
      setCapacityData(json);
    } catch {
      // Capacity is non-critical — show "—" on failure
      setCapacityData(null);
    } finally {
      setCapacityLoading(false);
    }
  }, []);

  useEffect(() => {
    // Run both fetches in parallel on mount and on each poll interval
    void Promise.all([fetchActions(), fetchCapacity()]);
    const interval = setInterval(() => {
      void Promise.all([fetchActions(), fetchCapacity()]);
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchActions, fetchCapacity]);

  const redActions = data?.summary.red ?? 0;
  const yellowActions = data?.summary.yellow ?? 0;

  return (
    <>
      {/* KPI summary cards */}
      <KpiSummaryBar
        redActions={redActions}
        yellowActions={yellowActions}
        clientsAtRisk={clientsAtRisk}
        activeClients={activeClients}
        capacityData={capacityData}
        loading={loading}
        capacityLoading={capacityLoading}
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
                {/* Urgency filter bar */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap border-b">
                  {(
                    [
                      { value: 'all', label: 'All', count: data.actions.length },
                      { value: 'red', label: 'Red', count: data.actions.filter((a) => a.urgency === 'red').length },
                      { value: 'yellow', label: 'Yellow', count: data.actions.filter((a) => a.urgency === 'yellow').length },
                    ] as const
                  ).map(({ value, label, count }) => {
                    const isActive = urgencyFilter === value;
                    const baseStyle: React.CSSProperties =
                      value === 'red'
                        ? { borderColor: '#C15B2E', color: isActive ? '#fff' : '#C15B2E', backgroundColor: isActive ? '#C15B2E' : 'transparent' }
                        : value === 'yellow'
                          ? { borderColor: '#D4754A', color: isActive ? '#fff' : '#D4754A', backgroundColor: isActive ? '#D4754A' : 'transparent' }
                          : { borderColor: '#1B2F26', color: isActive ? '#fff' : '#1B2F26', backgroundColor: isActive ? '#1B2F26' : 'transparent' };
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setUrgencyFilter(value)}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition-colors"
                        style={baseStyle}
                        aria-pressed={isActive}
                      >
                        {label}
                        <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)' }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const filtered = data.actions.filter(
                    (a) => urgencyFilter === 'all' || a.urgency === urgencyFilter
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No {urgencyFilter} actions pending.
                      </div>
                    );
                  }
                  return (
                    <>
                      {/* Desktop list */}
                      <div className="hidden sm:block divide-y">
                        {filtered.map((action) => (
                          <ActionRow key={action.id} action={action} />
                        ))}
                      </div>

                      {/* Mobile card stack */}
                      <div className="sm:hidden space-y-3 p-4">
                        {filtered.map((action) => (
                          <ActionCard key={action.id} action={action} />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}
