import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS, type AgencySession } from '@/lib/utils/route-handler';
import { ALL_PERMISSIONS, preventEscalation } from '@/lib/permissions';
import { getDb } from '@/db';
import { roleTemplates, auditLog } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async () => {
    const db = getDb();

    const templates = await db
      .select()
      .from(roleTemplates)
      .orderBy(desc(roleTemplates.isBuiltIn), roleTemplates.name);

    return NextResponse.json({ templates });
  }
);

const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  scope: z.enum(['agency', 'client']),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
}).strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async ({ request, session }) => {
    const body = await request.json();
    const validated = createRoleSchema.parse(body);

    // Validate all permissions are valid
    const invalidPerms = validated.permissions.filter(
      (p) => !ALL_PERMISSIONS.includes(p as typeof ALL_PERMISSIONS[number])
    );
    if (invalidPerms.length > 0) {
      return NextResponse.json(
        { error: 'Invalid permissions', details: invalidPerms },
        { status: 400 }
      );
    }

    // Escalation prevention: creator must hold all permissions in the new role
    try {
      preventEscalation(session.permissions, validated.permissions);
    } catch {
      return NextResponse.json(
        { error: 'Permission escalation denied' },
        { status: 403 }
      );
    }

    const db = getDb();

    // Generate slug from name
    const slug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Check if slug already exists
    const { eq } = await import('drizzle-orm');
    const [existingSlug] = await db
      .select({ id: roleTemplates.id })
      .from(roleTemplates)
      .where(eq(roleTemplates.slug, slug))
      .limit(1);

    if (existingSlug) {
      return NextResponse.json(
        { error: 'A role with a similar name already exists' },
        { status: 400 }
      );
    }

    const [template] = await db
      .insert(roleTemplates)
      .values({
        name: validated.name,
        slug,
        description: validated.description || null,
        scope: validated.scope,
        permissions: validated.permissions,
        isBuiltIn: false,
      })
      .returning();

    // Audit log
    await db.insert(auditLog).values({
      action: 'role.created',
      resourceType: 'role_template',
      resourceId: template.id,
      metadata: {
        roleName: validated.name,
        scope: validated.scope,
        permissionCount: validated.permissions.length,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ template });
  }
);
