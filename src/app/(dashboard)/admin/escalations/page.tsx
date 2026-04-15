import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/db';
import { escalationQueue, leads, clients, clientMemberships, people } from '@/db/schema';
import { inArray, eq, and } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { AlertTriangle, CheckCircle, ArrowRight, Clock, Building2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EscalationAssignSelect, type TeamMember } from './escalation-assign-select';
import { EscalationActions } from './escalation-actions';

interface EscalationRow {
  id: string;
  leadId: string;
  clientId: string;
  reason: string;
  reasonDetails: string | null;
  priority: number;
  status: string;
  slaBreach: boolean | null;
  slaDeadline: Date | null;
  assignedTo: string | null;
  createdAt: Date;
  leadName: string | null;
  leadPhone: string;
  clientBusinessName: string;
}

async function getOpenEscalations(): Promise<EscalationRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: escalationQueue.id,
      leadId: escalationQueue.leadId,
      clientId: escalationQueue.clientId,
      reason: escalationQueue.reason,
      reasonDetails: escalationQueue.reasonDetails,
      priority: escalationQueue.priority,
      status: escalationQueue.status,
      slaBreach: escalationQueue.slaBreach,
      slaDeadline: escalationQueue.slaDeadline,
      assignedTo: escalationQueue.assignedTo,
      createdAt: escalationQueue.createdAt,
      leadName: leads.name,
      leadPhone: leads.phone,
      clientBusinessName: clients.businessName,
    })
    .from(escalationQueue)
    .innerJoin(leads, eq(escalationQueue.leadId, leads.id))
    .innerJoin(clients, eq(escalationQueue.clientId, clients.id))
    .where(
      inArray(escalationQueue.status, ['pending', 'assigned', 'in_progress'])
    );

  rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return rows;
}

async function getTeamMembersByClient(
  clientIds: string[]
): Promise<Map<string, TeamMember[]>> {
  if (clientIds.length === 0) return new Map();

  const db = getDb();

  const rows = await db
    .select({
      clientId: clientMemberships.clientId,
      membershipId: clientMemberships.id,
      name: people.name,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(
      and(
        inArray(clientMemberships.clientId, clientIds),
        eq(clientMemberships.isActive, true)
      )
    );

  const map = new Map<string, TeamMember[]>();
  for (const row of rows) {
    const existing = map.get(row.clientId) ?? [];
    existing.push({ membershipId: row.membershipId, name: row.name });
    map.set(row.clientId, existing);
  }
  return map;
}

function getPriorityBadge(priority: number, slaBreach: boolean | null) {
  if (slaBreach) {
    return (
      <Badge className="bg-[#FDEAE4] text-sienna border border-sienna/20">
        SLA Breach
      </Badge>
    );
  }
  switch (priority) {
    case 1:
      return (
        <Badge className="bg-[#FDEAE4] text-sienna">P1 &mdash; Urgent</Badge>
      );
    case 2:
      return (
        <Badge className="bg-[#FFF3E0] text-sienna">P2 &mdash; High</Badge>
      );
    default:
      return <Badge variant="secondary">P{priority} &mdash; Normal</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-[#FFF3E0] text-sienna text-xs">Pending</Badge>
      );
    case 'assigned':
      return <Badge variant="secondary" className="text-xs">Assigned</Badge>;
    case 'in_progress':
      return (
        <Badge className="bg-forest text-white text-xs">In Progress</Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
}

function formatReason(reason: string): string {
  return reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function EscalationCard({
  row,
  teamMembers,
}: {
  row: EscalationRow;
  teamMembers: TeamMember[];
}) {
  const isUrgent = row.priority <= 2 || row.slaBreach;
  return (
    <Card
      className={`${isUrgent ? 'border-l-4 border-l-sienna' : ''}`}
    >
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          {getPriorityBadge(row.priority, row.slaBreach)}
          {getStatusBadge(row.status)}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{row.leadName ?? 'Unknown Lead'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{row.clientBusinessName}</span>
          </div>
        </div>
        <div className="text-sm font-medium">{formatReason(row.reason)}</div>
        {row.reasonDetails && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {row.reasonDetails}
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(row.createdAt, { addSuffix: true })}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Assign to</p>
          <EscalationAssignSelect
            escalationId={row.id}
            currentAssignedTo={row.assignedTo}
            teamMembers={teamMembers}
          />
        </div>
        <EscalationActions
          escalationId={row.id}
          clientId={row.clientId}
          reason={row.reason}
          reasonDetails={row.reasonDetails}
        />
        <Link
          href={`/leads/${row.leadId}`}
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline text-forest"
        >
          View lead
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function AdminEscalationsPage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const rows = await getOpenEscalations();

  const uniqueClientIds = [...new Set(rows.map((r) => r.clientId))];
  const teamMembersByClient = await getTeamMembersByClient(uniqueClientIds);

  const p1Count = rows.filter((r) => r.priority === 1).length;
  const p2Count = rows.filter((r) => r.priority === 2).length;
  const slaBreachedCount = rows.filter((r) => r.slaBreach).length;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Escalations' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold">Cross-Client Escalations</h1>
        <p className="text-muted-foreground">
          All open escalations across every client &mdash; sorted by priority then age.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">Total Open</div>
            <div className="text-2xl font-bold">{rows.length}</div>
            <div className="text-xs text-muted-foreground">escalations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">P1 Urgent</div>
            <div className={`text-2xl font-bold ${p1Count > 0 ? 'text-sienna' : ''}`}>
              {p1Count}
            </div>
            <div className="text-xs text-muted-foreground">need immediate action</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">P2 High</div>
            <div className={`text-2xl font-bold ${p2Count > 0 ? 'text-terracotta' : ''}`}>
              {p2Count}
            </div>
            <div className="text-xs text-muted-foreground">handle today</div>
          </CardContent>
        </Card>
        <Card className={slaBreachedCount > 0 ? 'border-sienna' : ''}>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">SLA Breached</div>
            <div
              className={`text-2xl font-bold ${slaBreachedCount > 0 ? 'text-sienna' : ''}`}
            >
              {slaBreachedCount}
            </div>
            <div className="text-xs text-muted-foreground">overdue</div>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-12 w-12 text-[#3D7A50] mx-auto mb-4" />
            <p className="text-lg font-medium">No open escalations</p>
            <p className="text-sm text-muted-foreground mt-1">All caught up &mdash; nice work.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="space-y-3 sm:hidden">
            {rows.map((row) => (
              <EscalationCard
                key={row.id}
                row={row}
                teamMembers={teamMembersByClient.get(row.clientId) ?? []}
              />
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Priority
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Client
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Lead
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Reason
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Assign To
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Age
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => {
                      const isUrgent = row.priority <= 2 || row.slaBreach;
                      const teamMembers = teamMembersByClient.get(row.clientId) ?? [];
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-muted/20 transition-colors ${isUrgent ? 'border-l-4 border-l-sienna' : ''}`}
                        >
                          <td className="px-4 py-3">
                            {getPriorityBadge(row.priority, row.slaBreach)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">{row.clientBusinessName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {row.leadName ?? 'Unknown Lead'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.leadPhone}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{formatReason(row.reason)}</div>
                            {row.reasonDetails && (
                              <div className="text-xs text-muted-foreground max-w-xs truncate">
                                {row.reasonDetails}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(row.status)}
                          </td>
                          <td className="px-4 py-3 min-w-[160px]">
                            <EscalationAssignSelect
                              escalationId={row.id}
                              currentAssignedTo={row.assignedTo}
                              teamMembers={teamMembers}
                            />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              {formatDistanceToNow(row.createdAt, { addSuffix: true })}
                            </div>
                          </td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <EscalationActions
                              escalationId={row.id}
                              clientId={row.clientId}
                              reason={row.reason}
                              reasonDetails={row.reasonDetails}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/leads/${row.leadId}`}
                              className="inline-flex items-center gap-1 text-sm font-medium hover:underline text-forest cursor-pointer"
                            >
                              View
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
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
