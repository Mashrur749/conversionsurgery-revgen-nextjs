import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Users, CalendarCheck, DollarSign, Bot } from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = 'red' | 'yellow' | 'green';

interface AggregateSummary {
  totalLeadsThisWeek: number;
  totalLeadsLastWeek: number;
  totalAppointmentsThisWeek: number;
  totalAppointmentsLastWeek: number;
  totalRevenueConfirmedCents: number;
  totalRevenueLastWeekCents: number;
  aiResolutionRate: number; // 0-100
  openEscalations: number;
}

interface ClientSummaryRow {
  id: string;
  businessName: string;
  leadsThisWeek: number;
  leadsLastWeek: number;
  appointmentsThisWeek: number;
  healthStatus: HealthStatus;
  openEscalations: number;
}

// ─── Health config ────────────────────────────────────────────────────────────

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

// ─── Delta helper ─────────────────────────────────────────────────────────────

function delta(current: number, previous: number): { symbol: string; className: string } {
  if (current > previous) return { symbol: '&#8593;', className: 'text-[#3D7A50]' };
  if (current < previous) return { symbol: '&#8595;', className: 'text-sienna' };
  return { symbol: '&#8594;', className: 'text-muted-foreground' };
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getAgencySummaryData(): Promise<{
  aggregate: AggregateSummary;
  clients: ClientSummaryRow[];
}> {
  const { getDb } = await import('@/db');
  const { clients, leads, appointments, escalationQueue, agentDecisions } = await import(
    '@/db/schema'
  );
  const { eq, and, inArray, gte, lt, sql, count: countFn, sum } = await import('drizzle-orm');

  const db = getDb();

  // Time windows
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // start of this week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);

  const lastWeekEnd = new Date(weekStart);

  // Active clients
  const activeClients = await db
    .select({ id: clients.id, businessName: clients.businessName, createdAt: clients.createdAt })
    .from(clients)
    .where(eq(clients.status, 'active'));

  if (activeClients.length === 0) {
    return {
      aggregate: {
        totalLeadsThisWeek: 0,
        totalLeadsLastWeek: 0,
        totalAppointmentsThisWeek: 0,
        totalAppointmentsLastWeek: 0,
        totalRevenueConfirmedCents: 0,
        totalRevenueLastWeekCents: 0,
        aiResolutionRate: 0,
        openEscalations: 0,
      },
      clients: [],
    };
  }

  const clientIds = activeClients.map((c) => c.id);

  // Week start as date string for daily_stats (date column)
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
  const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];

  const [
    leadsThisWeek,
    leadsLastWeek,
    appointmentsThisWeek,
    appointmentsLastWeek,
    revenueThisWeek,
    revenueLastWeek,
    openEscalations,
    aiDecisionsThisWeek,
    escalationsThisWeek,
  ] = await Promise.all([
    // Leads created this week per client
    db
      .select({ clientId: leads.clientId, count: countFn() })
      .from(leads)
      .where(and(inArray(leads.clientId, clientIds), gte(leads.createdAt, weekStart)))
      .groupBy(leads.clientId),

    // Leads created last week per client
    db
      .select({ clientId: leads.clientId, count: countFn() })
      .from(leads)
      .where(
        and(
          inArray(leads.clientId, clientIds),
          gte(leads.createdAt, lastWeekStart),
          lt(leads.createdAt, weekStart)
        )
      )
      .groupBy(leads.clientId),

    // Appointments booked this week per client
    db
      .select({ clientId: appointments.clientId, count: countFn() })
      .from(appointments)
      .where(
        and(
          inArray(appointments.clientId, clientIds),
          gte(appointments.createdAt, weekStart),
          inArray(appointments.status, ['scheduled', 'confirmed', 'completed'])
        )
      )
      .groupBy(appointments.clientId),

    // Appointments last week per client
    db
      .select({ clientId: appointments.clientId, count: countFn() })
      .from(appointments)
      .where(
        and(
          inArray(appointments.clientId, clientIds),
          gte(appointments.createdAt, lastWeekStart),
          lt(appointments.createdAt, weekStart),
          inArray(appointments.status, ['scheduled', 'confirmed', 'completed'])
        )
      )
      .groupBy(appointments.clientId),

    // Revenue confirmed this week (leads.status='won' updated this week)
    db
      .select({ total: sum(leads.confirmedRevenue) })
      .from(leads)
      .where(
        and(
          inArray(leads.clientId, clientIds),
          eq(leads.status, 'won'),
          gte(leads.updatedAt, weekStart)
        )
      ),

    // Revenue confirmed last week
    db
      .select({ total: sum(leads.confirmedRevenue) })
      .from(leads)
      .where(
        and(
          inArray(leads.clientId, clientIds),
          eq(leads.status, 'won'),
          gte(leads.updatedAt, lastWeekStart),
          lt(leads.updatedAt, weekStart)
        )
      ),

    // Open escalations (pending + in_progress) — total count
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

    // AI decisions this week (total)
    db
      .select({ count: countFn() })
      .from(agentDecisions)
      .where(
        and(inArray(agentDecisions.clientId, clientIds), gte(agentDecisions.createdAt, weekStart))
      ),

    // Escalation decisions this week (decisions with action='escalate')
    db
      .select({ count: countFn() })
      .from(agentDecisions)
      .where(
        and(
          inArray(agentDecisions.clientId, clientIds),
          gte(agentDecisions.createdAt, weekStart),
          eq(agentDecisions.action, 'escalate')
        )
      ),
  ]);

  // Build lookup maps
  const leadsThisWeekMap = new Map(leadsThisWeek.map((r) => [r.clientId, Number(r.count)]));
  const leadsLastWeekMap = new Map(leadsLastWeek.map((r) => [r.clientId, Number(r.count)]));
  const apptThisWeekMap = new Map(appointmentsThisWeek.map((r) => [r.clientId, Number(r.count)]));
  const apptLastWeekMap = new Map(appointmentsLastWeek.map((r) => [r.clientId, Number(r.count)]));
  const openEscMap = new Map(openEscalations.map((r) => [r.clientId, Number(r.count)]));

  // Aggregate totals
  const totalLeadsThisWeek = leadsThisWeek.reduce((s, r) => s + Number(r.count), 0);
  const totalLeadsLastWeek = leadsLastWeek.reduce((s, r) => s + Number(r.count), 0);
  const totalAppointmentsThisWeek = appointmentsThisWeek.reduce(
    (s, r) => s + Number(r.count),
    0
  );
  const totalAppointmentsLastWeek = appointmentsLastWeek.reduce(
    (s, r) => s + Number(r.count),
    0
  );
  const totalRevenueConfirmedCents = Number(revenueThisWeek[0]?.total ?? 0);
  const totalRevenueLastWeekCents = Number(revenueLastWeek[0]?.total ?? 0);
  const totalOpenEscalations = openEscalations.reduce((s, r) => s + Number(r.count), 0);

  const totalAiDecisions = Number(aiDecisionsThisWeek[0]?.count ?? 0);
  const totalEscalationDecisions = Number(escalationsThisWeek[0]?.count ?? 0);
  const aiResolutionRate =
    totalAiDecisions > 0
      ? Math.round(((totalAiDecisions - totalEscalationDecisions) / totalAiDecisions) * 100)
      : 0;

  // Build per-client health status (simplified from triage logic)
  function clientHealth(clientId: string, createdAt: Date | null): HealthStatus {
    const openEsc = openEscMap.get(clientId) ?? 0;
    if (openEsc > 0) return 'red';
    const clientAgeDays = createdAt
      ? (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const leadsThisWk = leadsThisWeekMap.get(clientId) ?? 0;
    const leadsLastWk = leadsLastWeekMap.get(clientId) ?? 0;
    if (clientAgeDays >= 14 && leadsThisWk === 0 && leadsLastWk === 0) return 'yellow';
    return 'green';
  }

  const clientRows: ClientSummaryRow[] = activeClients.map((c) => ({
    id: c.id,
    businessName: c.businessName,
    leadsThisWeek: leadsThisWeekMap.get(c.id) ?? 0,
    leadsLastWeek: leadsLastWeekMap.get(c.id) ?? 0,
    appointmentsThisWeek: apptThisWeekMap.get(c.id) ?? 0,
    healthStatus: clientHealth(c.id, c.createdAt),
    openEscalations: openEscMap.get(c.id) ?? 0,
  }));

  // Sort: red first, then yellow, then green; within tier sort by leads desc
  const tierOrder: Record<HealthStatus, number> = { red: 0, yellow: 1, green: 2 };
  clientRows.sort((a, b) => {
    const tierDiff = tierOrder[a.healthStatus] - tierOrder[b.healthStatus];
    return tierDiff !== 0 ? tierDiff : b.leadsThisWeek - a.leadsThisWeek;
  });

  return {
    aggregate: {
      totalLeadsThisWeek,
      totalLeadsLastWeek,
      totalAppointmentsThisWeek,
      totalAppointmentsLastWeek,
      totalRevenueConfirmedCents,
      totalRevenueLastWeekCents,
      aiResolutionRate,
      openEscalations: totalOpenEscalations,
    },
    clients: clientRows,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRevenue(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function WeekBadge({ current, previous }: { current: number; previous: number }) {
  const { symbol, className } = delta(current, previous);
  return (
    <span
      className={`text-xs font-medium ml-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: symbol }}
    />
  );
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

function ClientCard({ row }: { row: ClientSummaryRow }) {
  const config = HEALTH_CONFIG[row.healthStatus];
  const Icon = config.Icon;
  const d = delta(row.leadsThisWeek, row.leadsLastWeek);

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
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Leads</span>
              <div className="font-medium flex items-center">
                {row.leadsThisWeek}
                <span
                  className={`text-xs ml-1 ${d.className}`}
                  dangerouslySetInnerHTML={{ __html: d.symbol }}
                />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Appts</span>
              <div className="font-medium">{row.appointmentsThisWeek}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Escalations</span>
              <div
                className={`font-medium ${row.openEscalations > 0 ? 'text-sienna font-semibold' : 'text-muted-foreground'}`}
              >
                {row.openEscalations > 0 ? row.openEscalations : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AgencySummaryPage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const { aggregate, clients: clientRows } = await getAgencySummaryData();

  const revDelta = delta(aggregate.totalRevenueConfirmedCents, aggregate.totalRevenueLastWeekCents);
  const leadsDelta = delta(aggregate.totalLeadsThisWeek, aggregate.totalLeadsLastWeek);
  const apptDelta = delta(aggregate.totalAppointmentsThisWeek, aggregate.totalAppointmentsLastWeek);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Agency Summary</h1>
        <p className="text-muted-foreground">
          Your week at a glance &mdash; all clients in one view.
        </p>
      </div>

      {/* Aggregate stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads This Week</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {aggregate.totalLeadsThisWeek}
              <WeekBadge
                current={aggregate.totalLeadsThisWeek}
                previous={aggregate.totalLeadsLastWeek}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {aggregate.totalLeadsLastWeek} last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Appointments</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {aggregate.totalAppointmentsThisWeek}
              <WeekBadge
                current={aggregate.totalAppointmentsThisWeek}
                previous={aggregate.totalAppointmentsLastWeek}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {aggregate.totalAppointmentsLastWeek} last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Confirmed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {formatRevenue(aggregate.totalRevenueConfirmedCents)}
              <WeekBadge
                current={aggregate.totalRevenueConfirmedCents}
                previous={aggregate.totalRevenueLastWeekCents}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatRevenue(aggregate.totalRevenueLastWeekCents)} last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Resolution</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregate.aiResolutionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {aggregate.openEscalations > 0 ? (
                <span className="text-sienna font-medium">
                  {aggregate.openEscalations} open escalation{aggregate.openEscalations !== 1 ? 's' : ''}
                </span>
              ) : (
                'no open escalations'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Client table */}
      {clientRows.length === 0 ? (
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
            {clientRows.map((row) => (
              <ClientCard key={row.id} row={row} />
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
                        Leads This Week
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        vs Last Week
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        Appointments
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        Open Escalations
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clientRows.map((row) => {
                      const config = HEALTH_CONFIG[row.healthStatus];
                      const Icon = config.Icon;
                      const d = delta(row.leadsThisWeek, row.leadsLastWeek);
                      const diff = row.leadsThisWeek - row.leadsLastWeek;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-muted/20 transition-colors ${config.rowClass}`}
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
                          <td className="px-4 py-3 text-center font-medium">
                            {row.leadsThisWeek}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-medium ${d.className}`}>
                              {diff > 0 ? '+' : ''}{diff !== 0 ? diff : ''}
                              <span
                                className="ml-0.5"
                                dangerouslySetInnerHTML={{ __html: d.symbol }}
                              />
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.appointmentsThisWeek > 0 ? (
                              <span className="font-medium">{row.appointmentsThisWeek}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.openEscalations > 0 ? (
                              <span className="font-semibold text-sienna">
                                {row.openEscalations}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
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
