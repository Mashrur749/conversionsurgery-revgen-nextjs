import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { roleTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

/**
 * GET /api/client/team/roles
 * List available client-scoped role templates for adding team members.
 * Requires: portal.team.manage
 */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.TEAM_MANAGE },
  async ({ session }) => {
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
);
