import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { roleTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/client/team/roles
 * List available client-scoped role templates for adding team members.
 * Requires: portal.team.manage
 */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.TEAM_MANAGE);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getDb();

    // Load client-scoped role templates
    const templates = await db
      .select({
        id: roleTemplates.id,
        name: roleTemplates.name,
        slug: roleTemplates.slug,
      })
      .from(roleTemplates)
      .where(eq(roleTemplates.scope, 'client'))
      .orderBy(roleTemplates.name);

    // Non-owners cannot see the business_owner role template
    const filteredTemplates = session.isOwner
      ? templates
      : templates.filter((t) => t.slug !== 'business_owner');

    return NextResponse.json({ roles: filteredTemplates });
  } catch (error) {
    console.error('[ClientTeamRoles GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load roles' },
      { status: 500 }
    );
  }
}
