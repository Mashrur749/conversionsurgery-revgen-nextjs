import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import {
  people,
  clientMemberships,
  roleTemplates,
  clients,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ClientTeamClient } from './team-client';
import { ALL_PORTAL_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ClientTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const { id: clientId } = await params;
  const db = getDb();

  // Verify client exists
  const [client] = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    redirect('/admin/clients');
  }

  // Load all client members with roles
  const members = await db
    .select({
      membershipId: clientMemberships.id,
      personId: people.id,
      name: people.name,
      email: people.email,
      phone: people.phone,
      avatarUrl: people.avatarUrl,
      roleTemplateId: clientMemberships.roleTemplateId,
      roleName: roleTemplates.name,
      roleSlug: roleTemplates.slug,
      rolePermissions: roleTemplates.permissions,
      permissionOverrides: clientMemberships.permissionOverrides,
      isOwner: clientMemberships.isOwner,
      receiveEscalations: clientMemberships.receiveEscalations,
      receiveHotTransfers: clientMemberships.receiveHotTransfers,
      priority: clientMemberships.priority,
      isActive: clientMemberships.isActive,
      joinedAt: clientMemberships.createdAt,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(clientMemberships.roleTemplateId, roleTemplates.id))
    .where(eq(clientMemberships.clientId, clientId));

  // Load client-scoped role templates for add member dialog
  const clientRoles = await db
    .select({
      id: roleTemplates.id,
      name: roleTemplates.name,
      slug: roleTemplates.slug,
      permissions: roleTemplates.permissions,
    })
    .from(roleTemplates)
    .where(eq(roleTemplates.scope, 'client'));

  const serializedMembers = members.map((m) => ({
    ...m,
    joinedAt: m.joinedAt.toISOString(),
    permissionOverrides: m.permissionOverrides as { grant?: string[]; revoke?: string[] } | null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team &amp; Access</h1>
        <p className="text-muted-foreground">
          Manage who can access {client.businessName}&apos;s portal.
        </p>
      </div>

      <ClientTeamClient
        clientId={clientId}
        clientName={client.businessName}
        members={serializedMembers}
        clientRoles={clientRoles}
        allPortalPermissions={ALL_PORTAL_PERMISSIONS as unknown as string[]}
      />
    </div>
  );
}
