import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { TriageClientRow } from '@/app/api/admin/triage/route';

// Health configuration
const HEALTH_CONFIG = {
  red: {
    label: 'Urgent',
    badgeClass: 'bg-[#FDEAE4] text-sienna',
    rowClass: 'border-l-4 border-l-sienna',
    Icon: AlertTriangle,
    iconClass: 'text-sienna',
  },
  yellow: {
    label: 'Attention',
    badgeClass: 'bg-[#FFF3E0] text-sienna',
    rowClass: 'border-l-4 border-l-terracotta',
    Icon: Clock,
    iconClass: 'text-terracotta',
  },
  green: {
    label: 'Healthy',
    badgeClass: 'bg-[#E8F5E9] text-[#3D7A50]',
    rowClass: '',
    Icon: CheckCircle,
    iconClass: 'text-[#3D7A50]',
  },
} as const;

async function getTriageData(): Promise<TriageClientRow[]> {
  // Server-side direct DB query mirroring the API, but called inline for RSC
  const { getDb } = await import('@/db');
  const { clients, leads, escalationQueue, knowledgeGaps } = await import('@/db/schema');
  const { eq, and, inArray, gte, lt, or, sql, count: countFn } = await import('drizzle-orm');

  const db = getDb();

  const activeClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      status: clients.status,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  if (activeClients.length === 0) return [];

  const clientIds = activeClients.map((c) => c.id);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    escalationCounts,
    overdueEscalationCounts,
    kbGapCounts,
    recentEstimates,
    recentWonLost,
  ] = await Promise.all([
    db
      .select({ clientId: escalationQueue.clientId, count: countFn() })
      .from(escalationQueue)
      .where(
        and(
          inArray(escalationQueue.clientId, clientIds),
          inArray(escalationQueue.status, ['pending', 'in_progress'])
        )
      )
      .groupBy(escalationQueue.clientId),

    db
      .select({ clientId: escalationQueue.clientId, count: countFn() })
      .from(escalationQueue)
      .where(
        and(
          inArray(escalationQueue.clientId, clientIds),
          inArray(escalationQueue.status, ['pending', 'in_progress']),
          lt(escalationQueue.createdAt, oneDayAgo)
        )
      )
      .groupBy(escalationQueue.clientId),

    db
      .select({ clientId: knowledgeGaps.clientId, count: countFn() })
      .from(knowledgeGaps)
      .where(
        and(
          inArray(knowledgeGaps.clientId, clientIds),
          or(eq(knowledgeGaps.status, 'new'), eq(knowledgeGaps.status, 'in_review'))
        )
      )
      .groupBy(knowledgeGaps.clientId),

    db
      .select({
        clientId: leads.clientId,
        mostRecentAt: sql<string>`max(${leads.updatedAt})`.as('most_recent_at'),
      })
      .from(leads)
      .where(
        and(
          inArray(leads.clientId, clientIds),
          eq(leads.status, 'estimate_sent'),
          gte(leads.updatedAt, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(leads.clientId),

    db
      .select({
        clientId: leads.clientId,
        mostRecentAt: sql<string>`max(${leads.updatedAt})`.as('most_recent_at'),
      })
      .from(leads)
      .where(
        and(
          inArray(leads.clientId, clientIds),
          inArray(leads.status, ['won', 'lost']),
          gte(leads.updatedAt, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(leads.clientId),
  ]);

  const escalationMap = new Map(escalationCounts.map((r) => [r.clientId, Number(r.count)]));
  const overdueMap = new Map(overdueEscalationCounts.map((r) => [r.clientId, Number(r.count)]));
  const kbGapMap = new Map(kbGapCounts.map((r) => [r.clientId, Number(r.count)]));
  const estimateMap = new Map(recentEstimates.map((r) => [r.clientId, r.mostRecentAt]));
  const wonLostMap = new Map(recentWonLost.map((r) => [r.clientId, r.mostRecentAt]));

  function daysSince(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  function computeHealth(
    row: Omit<TriageClientRow, 'healthStatus' | 'actionNeeded'>
  ): { healthStatus: 'green' | 'yellow' | 'red'; actionNeeded: string[] } {
    const actions: string[] = [];
    let isRed = false;
    let isYellow = false;

    if (row.overdueEscalations > 0) {
      isRed = true;
      actions.push(
        `${row.overdueEscalations} escalation${row.overdueEscalations > 1 ? 's' : ''} open 24+ hours`
      );
    }

    const clientAgeDays =
      (now.getTime() - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    if (clientAgeDays >= 60 && (row.daysSinceEstimate === null || row.daysSinceEstimate >= 30)) {
      isRed = true;
      actions.push(
        row.daysSinceEstimate === null
          ? 'No estimate activity recorded'
          : `${row.daysSinceEstimate}d since last estimate sent`
      );
    }

    if (row.openKbGaps >= 5) {
      isYellow = true;
      actions.push(`${row.openKbGaps} open KB gaps`);
    }

    if (
      !isRed &&
      clientAgeDays >= 60 &&
      row.daysSinceEstimate !== null &&
      row.daysSinceEstimate >= 21 &&
      row.daysSinceEstimate < 30
    ) {
      isYellow = true;
      actions.push(`${row.daysSinceEstimate}d since last estimate sent`);
    }

    if (row.daysSinceWonOrLost !== null && row.daysSinceWonOrLost >= 30) {
      isYellow = true;
      actions.push(`${row.daysSinceWonOrLost}d since last win/loss update`);
    }

    return { healthStatus: isRed ? 'red' : isYellow ? 'yellow' : 'green', actionNeeded: actions };
  }

  const rows: TriageClientRow[] = activeClients.map((c) => {
    const baseRow = {
      id: c.id,
      businessName: c.businessName,
      status: c.status,
      createdAt: c.createdAt!.toISOString(),
      openEscalations: escalationMap.get(c.id) ?? 0,
      overdueEscalations: overdueMap.get(c.id) ?? 0,
      openKbGaps: kbGapMap.get(c.id) ?? 0,
      daysSinceEstimate: daysSince(estimateMap.get(c.id)),
      daysSinceWonOrLost: daysSince(wonLostMap.get(c.id)),
    };
    const { healthStatus, actionNeeded } = computeHealth(baseRow);
    return { ...baseRow, healthStatus, actionNeeded };
  });

  const tierOrder = { red: 0, yellow: 1, green: 2 };
  rows.sort((a, b) => {
    const diff = tierOrder[a.healthStatus] - tierOrder[b.healthStatus];
    return diff !== 0 ? diff : b.overdueEscalations - a.overdueEscalations;
  });

  return rows;
}

function MetricCell({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <span className="text-sm">
      {value}
      <span className="text-xs text-muted-foreground ml-0.5">{label}</span>
    </span>
  );
}

// Mobile card for a single client row
function TriageCard({ row }: { row: TriageClientRow }) {
  const config = HEALTH_CONFIG[row.healthStatus];
  const Icon = config.Icon;
  return (
    <Link href={`/admin/clients/${row.id}`}>
      <Card className={`hover:shadow-md transition-shadow ${config.rowClass}`}>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${config.iconClass}`} />
              <span className="font-semibold text-sm">{row.businessName}</span>
            </div>
            <Badge className={config.badgeClass}>{config.label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Escalations</span>
              <div className="font-medium">{row.openEscalations}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">KB Gaps</span>
              <div className="font-medium">{row.openKbGaps}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Days Since Estimate</span>
              <div className="font-medium">{row.daysSinceEstimate ?? '—'}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Days Since Win/Lost</span>
              <div className="font-medium">{row.daysSinceWonOrLost ?? '—'}</div>
            </div>
          </div>
          {row.actionNeeded.length > 0 && (
            <ul className="space-y-1">
              {row.actionNeeded.map((action) => (
                <li key={action} className="text-xs text-sienna flex items-start gap-1">
                  <span className="mt-0.5">&#8226;</span>
                  {action}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function TriagePage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const rows = await getTriageData();

  const redCount = rows.filter((r) => r.healthStatus === 'red').length;
  const yellowCount = rows.filter((r) => r.healthStatus === 'yellow').length;
  const greenCount = rows.filter((r) => r.healthStatus === 'green').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Client Triage</h1>
        <p className="text-muted-foreground">
          Daily health check &mdash; clients ranked by urgency. Check this first thing each day.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sienna">{redCount}</div>
            <p className="text-xs text-muted-foreground">need action now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#C15B2E' }}>
              {yellowCount}
            </div>
            <p className="text-xs text-muted-foreground">need follow-up soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#3D7A50]">{greenCount}</div>
            <p className="text-xs text-muted-foreground">no action needed</p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-8 w-8 text-[#3D7A50] mx-auto mb-3" />
            <p className="text-muted-foreground">No active clients found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Active clients will appear here once onboarded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="space-y-3 sm:hidden">
            {rows.map((row) => (
              <TriageCard key={row.id} row={row} />
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Health</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        Escalations
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        KB Gaps
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        Days Since Estimate
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        Days Since Win/Lost
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Action Needed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => {
                      const config = HEALTH_CONFIG[row.healthStatus];
                      const Icon = config.Icon;
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-muted/20 transition-colors cursor-pointer ${config.rowClass}`}
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/clients/${row.id}`}
                              className="font-medium hover:underline"
                            >
                              {row.businessName}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeClass}`}
                            >
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={
                                row.overdueEscalations > 0
                                  ? 'font-semibold text-sienna'
                                  : row.openEscalations > 0
                                  ? 'font-medium'
                                  : 'text-muted-foreground'
                              }
                            >
                              {row.openEscalations}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={
                                row.openKbGaps >= 5
                                  ? 'font-semibold text-sienna'
                                  : row.openKbGaps > 0
                                  ? 'font-medium'
                                  : 'text-muted-foreground'
                              }
                            >
                              {row.openKbGaps}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <MetricCell value={row.daysSinceEstimate} label="d" />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <MetricCell value={row.daysSinceWonOrLost} label="d" />
                          </td>
                          <td className="px-4 py-3">
                            {row.actionNeeded.length === 0 ? (
                              <span className="text-muted-foreground text-xs">None</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {row.actionNeeded.map((action) => (
                                  <li key={action} className="text-xs text-sienna">
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
