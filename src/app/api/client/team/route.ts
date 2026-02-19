import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import {
  clientMemberships,
  people,
  roleTemplates,
  auditLog,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  requirePortalPermission,
  PORTAL_PERMISSIONS,
  preventEscalation,
} from '@/lib/permissions';
import { normalizePhoneNumber } from '@/lib/utils/phone';

/**
 * GET /api/client/team
 * List all team members (client memberships) for the current business.
 * Requires: portal.team.view
 */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.TEAM_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { clientId } = session;

  try {
    const db = getDb();

    const members = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
        isActive: clientMemberships.isActive,
        roleTemplateId: clientMemberships.roleTemplateId,
        createdAt: clientMemberships.createdAt,
        personName: people.name,
        personEmail: people.email,
        personPhone: people.phone,
        lastLoginAt: people.lastLoginAt,
        roleName: roleTemplates.name,
        roleSlug: roleTemplates.slug,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(people.id, clientMemberships.personId))
      .innerJoin(roleTemplates, eq(roleTemplates.id, clientMemberships.roleTemplateId))
      .where(eq(clientMemberships.clientId, clientId))
      .orderBy(clientMemberships.isOwner, clientMemberships.createdAt);

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[ClientTeam GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load team members' },
      { status: 500 }
    );
  }
}

const addMemberSchema = z
  .object({
    name: z.string().min(1).max(255),
    email: z.string().email().max(255).optional(),
    phone: z.string().min(1).max(20).optional(),
    roleTemplateId: z.string().uuid(),
  })
  .strict()
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
  });

/**
 * POST /api/client/team
 * Add a new team member to the current business.
 * Requires: portal.team.manage
 * Escalation prevention: can only assign roles with permissions the granter holds.
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.TEAM_MANAGE);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { clientId, personId: granterId, permissions: granterPermissions } = session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone: rawPhone, roleTemplateId } = parsed.data;
  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : undefined;

  try {
    const db = getDb();

    // Load the target role template to check permissions
    const [targetTemplate] = await db
      .select({
        permissions: roleTemplates.permissions,
        scope: roleTemplates.scope,
        name: roleTemplates.name,
      })
      .from(roleTemplates)
      .where(eq(roleTemplates.id, roleTemplateId))
      .limit(1);

    if (!targetTemplate) {
      return NextResponse.json(
        { error: 'Role template not found' },
        { status: 404 }
      );
    }

    if (targetTemplate.scope !== 'client') {
      return NextResponse.json(
        { error: 'Invalid role template scope. Must be a client role.' },
        { status: 400 }
      );
    }

    // Escalation prevention: granter must hold all permissions in the target role
    // Owners can assign any client-scoped role
    if (!session.isOwner) {
      try {
        preventEscalation(granterPermissions, targetTemplate.permissions);
      } catch (escalationError) {
        return NextResponse.json(
          { error: escalationError instanceof Error ? escalationError.message : 'Permission escalation denied' },
          { status: 403 }
        );
      }
    }

    // Find or create person
    let personRecord: { id: string } | undefined;

    if (email) {
      const [existing] = await db
        .select({ id: people.id })
        .from(people)
        .where(eq(people.email, email))
        .limit(1);
      personRecord = existing;
    }

    if (!personRecord && phone) {
      const [existing] = await db
        .select({ id: people.id })
        .from(people)
        .where(eq(people.phone, phone))
        .limit(1);
      personRecord = existing;
    }

    if (!personRecord) {
      // Create new person
      const [newPerson] = await db
        .insert(people)
        .values({
          name,
          email: email || null,
          phone: phone || null,
        })
        .returning({ id: people.id });
      personRecord = newPerson;
    }

    // Check if membership already exists
    const [existingMembership] = await db
      .select({ id: clientMemberships.id, isActive: clientMemberships.isActive })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.personId, personRecord.id),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (existingMembership) {
      if (existingMembership.isActive) {
        return NextResponse.json(
          { error: 'This person already has access to this business.' },
          { status: 409 }
        );
      }
      // Reactivate existing membership with new role
      await db
        .update(clientMemberships)
        .set({
          roleTemplateId,
          isActive: true,
          invitedBy: granterId,
          updatedAt: new Date(),
        })
        .where(eq(clientMemberships.id, existingMembership.id));

      // Audit log
      await db.insert(auditLog).values({
        personId: granterId,
        clientId,
        action: 'team.member_reactivated',
        resourceType: 'client_membership',
        resourceId: existingMembership.id,
        metadata: { targetPersonId: personRecord.id, roleTemplateId },
      });

      return NextResponse.json(
        { success: true, membershipId: existingMembership.id },
        { status: 200 }
      );
    }

    // Create new membership
    const [newMembership] = await db
      .insert(clientMemberships)
      .values({
        personId: personRecord.id,
        clientId,
        roleTemplateId,
        invitedBy: granterId,
      })
      .returning({ id: clientMemberships.id });

    // Audit log
    await db.insert(auditLog).values({
      personId: granterId,
      clientId,
      action: 'team.member_added',
      resourceType: 'client_membership',
      resourceId: newMembership.id,
      metadata: { targetPersonId: personRecord.id, roleTemplateId },
    });

    return NextResponse.json(
      { success: true, membershipId: newMembership.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ClientTeam POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}
