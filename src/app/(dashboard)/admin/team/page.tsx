import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import {
  people,
  agencyMemberships,
  roleTemplates,
  agencyClientAssignments,
  clients,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { AgencyTeamClient } from './team-client';

export const dynamic = 'force-dynamic';

export default async function AgencyTeamPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  // Load all agency members with roles
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

  // Load client assignments for scoped members
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

  // Load agency-scoped role templates for invite dialog
  const agencyRoles = await db
    .select({
      id: roleTemplates.id,
      name: roleTemplates.name,
      slug: roleTemplates.slug,
    })
    .from(roleTemplates)
    .where(eq(roleTemplates.scope, 'agency'));

  // Load all clients for client scope assignment
  const allClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
    })
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agency Team</h1>
        <p className="text-muted-foreground">
          Manage who has access to the agency dashboard.
        </p>
      </div>

      <AgencyTeamClient
        members={enrichedMembers}
        agencyRoles={agencyRoles}
        allClients={allClients}
      />
    </div>
  );
}
