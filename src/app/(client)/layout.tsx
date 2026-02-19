import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clientMemberships, clients, roleTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolvePermissions } from '@/lib/permissions/resolve';
import type { PermissionOverrides } from '@/lib/permissions/resolve';
import { HelpButton } from '@/components/ui/help-button';
import { ClientNav } from '@/components/client-nav';
import { PermissionProvider } from '@/components/permission-provider';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClientSession();

  if (!session) {
    redirect('/client-login');
  }

  // Default values for legacy sessions
  let permissions: string[] = [];
  let isOwner = false;
  let personId = '';
  let businesses: { clientId: string; businessName: string }[] = [];

  if ('personId' in session) {
    // New-format session: permissions are in the cookie
    personId = session.personId;
    permissions = session.permissions;

    // Load membership to get isOwner flag
    const db = getDb();
    const [membership] = await db
      .select({ isOwner: clientMemberships.isOwner })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.personId, session.personId),
          eq(clientMemberships.clientId, session.clientId),
          eq(clientMemberships.isActive, true)
        )
      )
      .limit(1);

    isOwner = membership?.isOwner ?? false;

    // Load all active memberships for business switcher
    const allMemberships = await db
      .select({
        clientId: clientMemberships.clientId,
        businessName: clients.businessName,
      })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(
        and(
          eq(clientMemberships.personId, session.personId),
          eq(clientMemberships.isActive, true),
          eq(clients.status, 'active')
        )
      );

    businesses = allMemberships;
  } else {
    // Legacy session: look up owner membership for permissions
    const db = getDb();
    const [membership] = await db
      .select({
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
        roleTemplateId: clientMemberships.roleTemplateId,
        permissionOverrides: clientMemberships.permissionOverrides,
      })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.clientId, session.clientId),
          eq(clientMemberships.isOwner, true),
          eq(clientMemberships.isActive, true)
        )
      )
      .limit(1);

    if (membership) {
      personId = membership.personId;
      isOwner = membership.isOwner;

      const [template] = await db
        .select({ permissions: roleTemplates.permissions })
        .from(roleTemplates)
        .where(eq(roleTemplates.id, membership.roleTemplateId))
        .limit(1);

      if (template) {
        const overrides = membership.permissionOverrides as PermissionOverrides | null;
        const resolved = resolvePermissions(template.permissions, overrides);
        permissions = Array.from(resolved);
      }
    }
  }

  const showSwitcher = businesses.length > 1;

  return (
    <PermissionProvider
      permissions={permissions}
      isOwner={isOwner}
      personId={personId}
      clientId={session.clientId}
    >
      <div className="min-h-screen bg-[#F8F9FA]">
        <ClientNav
          businessName={session.client.businessName}
          permissions={permissions}
          showSwitcher={showSwitcher}
          businesses={showSwitcher ? businesses : undefined}
          currentClientId={session.clientId}
        />
        <main className="max-w-3xl mx-auto px-4 py-6">
          {children}
        </main>
        <HelpButton />
      </div>
    </PermissionProvider>
  );
}
