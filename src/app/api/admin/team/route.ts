import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { getDb } from '@/db';
import {
  people,
  agencyMemberships,
  roleTemplates,
  agencyClientAssignments,
  auditLog,
  clients,
} from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

export async function GET() {
  try {
    const session = await auth();
    requireAdmin(session);

    const db = getDb();

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
        sessionVersion: agencyMemberships.sessionVersion,
        invitedBy: agencyMemberships.invitedBy,
        joinedAt: agencyMemberships.createdAt,
      })
      .from(agencyMemberships)
      .innerJoin(people, eq(agencyMemberships.personId, people.id))
      .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
      .orderBy(desc(agencyMemberships.createdAt));

    // Load client assignments for scoped members
    const scopedMemberIds = members
      .filter((m) => m.clientScope === 'assigned')
      .map((m) => m.membershipId);

    let assignmentsMap: Record<string, { clientId: string; clientName: string }[]> = {};

    if (scopedMemberIds.length > 0) {
      const assignments = await db
        .select({
          agencyMembershipId: agencyClientAssignments.agencyMembershipId,
          clientId: agencyClientAssignments.clientId,
          clientName: clients.businessName,
        })
        .from(agencyClientAssignments)
        .innerJoin(clients, eq(agencyClientAssignments.clientId, clients.id));

      assignmentsMap = {};
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
      assignedClients: m.clientScope === 'assigned'
        ? assignmentsMap[m.membershipId] || []
        : null,
    }));

    return NextResponse.json({ members: enrichedMembers });
  } catch (error) {
    if (error instanceof Error && error.message.includes('admin access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('GET /api/admin/team error:', error);
    return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 });
  }
}

const inviteMemberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  roleTemplateId: z.string().uuid('Valid role template ID is required'),
  clientScope: z.enum(['all', 'assigned']).default('all'),
  assignedClientIds: z.array(z.string().uuid()).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    requireAdmin(session);

    const body = await request.json();
    const validated = inviteMemberSchema.parse(body);

    const db = getDb();

    // Verify role template exists and is agency-scoped
    const [template] = await db
      .select()
      .from(roleTemplates)
      .where(eq(roleTemplates.id, validated.roleTemplateId))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: 'Role template not found' }, { status: 404 });
    }

    if (template.scope !== 'agency') {
      return NextResponse.json(
        { error: 'Only agency-scoped role templates can be used for agency members' },
        { status: 400 }
      );
    }

    // Prevent assigning owner role
    if (template.slug === 'agency_owner') {
      return NextResponse.json(
        { error: 'Cannot assign the Agency Owner role' },
        { status: 400 }
      );
    }

    // Find or create person by email
    let [person] = await db
      .select()
      .from(people)
      .where(eq(people.email, validated.email))
      .limit(1);

    if (!person) {
      [person] = await db
        .insert(people)
        .values({
          name: validated.name,
          email: validated.email,
        })
        .returning();
    }

    // Check if person already has an agency membership
    const [existingMembership] = await db
      .select()
      .from(agencyMemberships)
      .where(eq(agencyMemberships.personId, person.id))
      .limit(1);

    if (existingMembership) {
      return NextResponse.json(
        { error: 'This person already has an agency membership' },
        { status: 400 }
      );
    }

    // Create agency membership
    const [membership] = await db
      .insert(agencyMemberships)
      .values({
        personId: person.id,
        roleTemplateId: validated.roleTemplateId,
        clientScope: validated.clientScope,
        isActive: true,
      })
      .returning();

    // Create client assignments if scoped
    if (validated.clientScope === 'assigned' && validated.assignedClientIds?.length) {
      await db.insert(agencyClientAssignments).values(
        validated.assignedClientIds.map((clientId) => ({
          agencyMembershipId: membership.id,
          clientId,
        }))
      );
    }

    // Audit log
    await db.insert(auditLog).values({
      personId: person.id,
      action: 'member.invited',
      resourceType: 'agency_membership',
      resourceId: membership.id,
      metadata: {
        memberName: validated.name,
        memberEmail: validated.email,
        role: template.slug,
        roleName: template.name,
        clientScope: validated.clientScope,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      membership: {
        ...membership,
        person,
        role: template,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('admin access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/admin/team error:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
