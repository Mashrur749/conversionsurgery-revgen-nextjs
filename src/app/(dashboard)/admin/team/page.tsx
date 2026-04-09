import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import {
  people,
  agencyMemberships,
  roleTemplates,
  agencyClientAssignments,
  clients,
  users,
  clientMemberships,
} from '@/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgencyTeamClient } from './team-client';
import { RolesClient } from '../roles/roles-client';
import { UserList } from '../users/user-list';
import { TeamTabs } from './team-tabs';

export const dynamic = 'force-dynamic';

export default async function AgencyTeamPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  // ── Members tab data ──
  const members = await db
    .select({
      membershipId: agencyMemberships.id,
      personId: people.id,
      name: people.name,
      email: people.email,
      phone: people.phone,
      avatarUrl: people.avatarUrl,
      roleTemplateId: agencyMemberships.roleTemplateId,
      roleName: roleTemplates.name,
      roleSlug: roleTemplates.slug,
      clientScope: agencyMemberships.clientScope,
      isActive: agencyMemberships.isActive,
      joinedAt: agencyMemberships.createdAt,
    })
    .from(agencyMemberships)
    .innerJoin(people, eq(agencyMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
    .orderBy(desc(agencyMemberships.createdAt));

  const scopedIds = members
    .filter((m) => m.clientScope === 'assigned')
    .map((m) => m.membershipId);

  const assignmentsMap: Record<string, { clientId: string; clientName: string }[]> = {};

  if (scopedIds.length > 0) {
    const assignments = await db
      .select({
        agencyMembershipId: agencyClientAssignments.agencyMembershipId,
        clientId: agencyClientAssignments.clientId,
        clientName: clients.businessName,
      })
      .from(agencyClientAssignments)
      .innerJoin(clients, eq(agencyClientAssignments.clientId, clients.id));

    for (const a of assignments) {
      if (!assignmentsMap[a.agencyMembershipId]) {
        assignmentsMap[a.agencyMembershipId] = [];
      }
      assignmentsMap[a.agencyMembershipId].push({
        clientId: a.clientId,
        clientName: a.clientName,
      });
    }
  }

  const enrichedMembers = members.map((m) => ({
    ...m,
    joinedAt: m.joinedAt.toISOString(),
    assignedClients: m.clientScope === 'assigned'
      ? assignmentsMap[m.membershipId] || []
      : null,
  }));

  const agencyRoles = await db
    .select({ id: roleTemplates.id, name: roleTemplates.name, slug: roleTemplates.slug })
    .from(roleTemplates)
    .where(eq(roleTemplates.scope, 'agency'));

  const allClients = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  // ── Roles tab data ──
  const templates = await db
    .select()
    .from(roleTemplates)
    .orderBy(desc(roleTemplates.isBuiltIn), roleTemplates.name);

  const agencyUsage = await db
    .select({ roleTemplateId: agencyMemberships.roleTemplateId, total: count() })
    .from(agencyMemberships)
    .groupBy(agencyMemberships.roleTemplateId);

  const clientUsage = await db
    .select({ roleTemplateId: clientMemberships.roleTemplateId, total: count() })
    .from(clientMemberships)
    .groupBy(clientMemberships.roleTemplateId);

  const usageMap: Record<string, number> = {};
  for (const u of agencyUsage) {
    usageMap[u.roleTemplateId] = (usageMap[u.roleTemplateId] || 0) + u.total;
  }
  for (const u of clientUsage) {
    usageMap[u.roleTemplateId] = (usageMap[u.roleTemplateId] || 0) + u.total;
  }

  const enrichedTemplates = templates.map((t) => ({
    ...t,
    usageCount: usageMap[t.id] || 0,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const userPermissions = session.user.permissions || [];

  // ── Users tab data ──
  const allUsers = await db
    .select({
      id: users.id,
      name: sql<string | null>`COALESCE(${people.name}, ${users.name})`,
      email: sql<string>`COALESCE(${people.email}, ${users.email})`,
      hasAgencyAccess: sql<boolean>`${agencyMemberships.id} IS NOT NULL`,
      clientId: sql<string | null>`${clientMemberships.clientId}`,
      clientName: sql<string | null>`${clients.businessName}`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(people, eq(users.personId, people.id))
    .leftJoin(agencyMemberships, eq(people.id, agencyMemberships.personId))
    .leftJoin(clientMemberships, eq(people.id, clientMemberships.personId))
    .leftJoin(clients, eq(clientMemberships.clientId, clients.id))
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground">
          Manage team members, roles, and portal access.
        </p>
      </div>

      <TeamTabs
        membersContent={
          <AgencyTeamClient
            members={enrichedMembers}
            agencyRoles={agencyRoles}
            allClients={allClients}
          />
        }
        rolesContent={
          <RolesClient templates={enrichedTemplates} userPermissions={userPermissions} />
        }
        usersContent={
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <UserList
                users={allUsers}
                clients={allClients}
                currentUserId={session.user!.id!}
              />
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
