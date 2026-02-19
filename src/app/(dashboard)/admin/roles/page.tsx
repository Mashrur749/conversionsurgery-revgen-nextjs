import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { roleTemplates, agencyMemberships, clientMemberships } from '@/db/schema';
import { eq, count, desc } from 'drizzle-orm';
import { RolesClient } from './roles-client';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  const templates = await db
    .select()
    .from(roleTemplates)
    .orderBy(desc(roleTemplates.isBuiltIn), roleTemplates.name);

  // Get usage counts for each template
  const agencyUsage = await db
    .select({
      roleTemplateId: agencyMemberships.roleTemplateId,
      total: count(),
    })
    .from(agencyMemberships)
    .groupBy(agencyMemberships.roleTemplateId);

  const clientUsage = await db
    .select({
      roleTemplateId: clientMemberships.roleTemplateId,
      total: count(),
    })
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Role Templates</h1>
        <p className="text-muted-foreground">
          Define permission bundles for team members.
        </p>
      </div>

      <RolesClient templates={enrichedTemplates} />
    </div>
  );
}
