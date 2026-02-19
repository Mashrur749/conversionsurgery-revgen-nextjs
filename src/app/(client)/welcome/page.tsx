import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/db';
import { people, clientMemberships, roleTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClientSession } from '@/lib/client-auth';
import { resolvePermissions } from '@/lib/permissions/resolve';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import type { PermissionOverrides } from '@/lib/permissions/resolve';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Feature descriptions mapped to permissions.
 * Shown on the welcome page to help new users understand their access.
 */
const FEATURE_MAP: { permission: string; label: string; description: string }[] = [
  {
    permission: PORTAL_PERMISSIONS.DASHBOARD,
    label: 'Dashboard',
    description: 'Overview of your business performance and key metrics',
  },
  {
    permission: PORTAL_PERMISSIONS.LEADS_VIEW,
    label: 'Leads',
    description: 'View and track incoming leads',
  },
  {
    permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW,
    label: 'Conversations',
    description: 'Read customer conversations and messages',
  },
  {
    permission: PORTAL_PERMISSIONS.REVENUE_VIEW,
    label: 'Revenue',
    description: 'Track revenue and financial metrics',
  },
  {
    permission: PORTAL_PERMISSIONS.ANALYTICS_VIEW,
    label: 'Analytics',
    description: 'View detailed analytics and reporting',
  },
  {
    permission: PORTAL_PERMISSIONS.REVIEWS_VIEW,
    label: 'Reviews',
    description: 'Monitor and manage customer reviews',
  },
  {
    permission: PORTAL_PERMISSIONS.KNOWLEDGE_VIEW,
    label: 'Knowledge Base',
    description: 'Access and manage business knowledge articles',
  },
  {
    permission: PORTAL_PERMISSIONS.TEAM_VIEW,
    label: 'Team',
    description: 'View team members who have portal access',
  },
  {
    permission: PORTAL_PERMISSIONS.SETTINGS_VIEW,
    label: 'Settings',
    description: 'View and manage portal settings',
  },
];

export default async function WelcomePage() {
  const session = await getClientSession();
  if (!session) {
    redirect('/client-login');
  }

  // Only show welcome for new-format sessions (with personId)
  if (!('personId' in session)) {
    redirect('/client');
  }

  const db = getDb();

  // Check if this is the first login
  const [person] = await db
    .select({ lastLoginAt: people.lastLoginAt })
    .from(people)
    .where(eq(people.id, session.personId))
    .limit(1);

  if (!person || person.lastLoginAt !== null) {
    // Not first login - go to dashboard
    redirect('/client');
  }

  // Load membership and role info
  const [membership] = await db
    .select({
      roleTemplateId: clientMemberships.roleTemplateId,
      permissionOverrides: clientMemberships.permissionOverrides,
      isOwner: clientMemberships.isOwner,
    })
    .from(clientMemberships)
    .where(
      and(
        eq(clientMemberships.personId, session.personId),
        eq(clientMemberships.clientId, session.clientId),
        eq(clientMemberships.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    redirect('/client-login');
  }

  const [template] = await db
    .select({
      name: roleTemplates.name,
      permissions: roleTemplates.permissions,
    })
    .from(roleTemplates)
    .where(eq(roleTemplates.id, membership.roleTemplateId))
    .limit(1);

  if (!template) {
    redirect('/client');
  }

  const overrides = membership.permissionOverrides as PermissionOverrides | null;
  const resolved = resolvePermissions(template.permissions, overrides);
  const permissionsList = Array.from(resolved);

  const accessibleFeatures = FEATURE_MAP.filter((f) =>
    permissionsList.includes(f.permission)
  );

  // Update lastLoginAt so welcome is not shown again
  await db
    .update(people)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(people.id, session.personId));

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Welcome to {session.client.businessName}
          </CardTitle>
          <p className="text-muted-foreground mt-1">
            You&apos;ve been added as <span className="font-medium text-foreground">{template.name}</span>.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Here&apos;s what you can access:
          </p>
          <ul className="space-y-3">
            {accessibleFeatures.map((feature) => (
              <li key={feature.permission} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  &#x2713;
                </span>
                <div>
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" size="lg">
            <Link href="/client">Get Started</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
