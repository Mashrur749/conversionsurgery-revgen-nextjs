import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb } from '@/db';
import { people, clientMemberships, roleTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getTeamMembers, getTotalTeamMemberCount } from '@/lib/services/team-bridge';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin can pass clientId as query param; regular users use getClientId()
    let clientId: string | null = null;
    if (session.user?.isAdmin) {
      clientId = req.nextUrl.searchParams.get('clientId');
    }
    if (!clientId) {
      clientId = await getClientId();
    }

    if (!clientId) {
      return Response.json({ error: 'No client' }, { status: 403 });
    }

    const members = await getTeamMembers(clientId);

    return Response.json({ success: true, members, teamMembers: members });
  } catch (error) {
    console.error('[TeamHours] Team members fetch error:', error);
    return Response.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

const createSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  role: z.string().optional(),
  receiveEscalations: z.boolean().optional().default(true),
  receiveHotTransfers: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const parsed = createSchema.safeParse(data);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const validated = parsed.data;

    // Check usage limit for team members
    const { checkUsageLimit } = await import('@/lib/services/subscription');
    const currentCount = await getTotalTeamMemberCount(validated.clientId);
    const usageCheck = await checkUsageLimit(validated.clientId, 'team_members', currentCount);
    if (!usageCheck.allowed) {
      return Response.json(
        { error: `Team member limit reached (${usageCheck.current}/${usageCheck.limit}). Upgrade your plan for more capacity.` },
        { status: 403 }
      );
    }

    const db = getDb();
    const normalizedPhone = normalizePhoneNumber(validated.phone);
    const normalizedEmail = validated.email || null;

    // Find the default "team_member" role template
    const [defaultRole] = await db
      .select()
      .from(roleTemplates)
      .where(and(
        eq(roleTemplates.slug, 'team_member'),
        eq(roleTemplates.scope, 'client')
      ))
      .limit(1);

    if (!defaultRole) {
      return Response.json(
        { error: 'Default team member role not configured. Run seed-role-templates.' },
        { status: 500 }
      );
    }

    // Create person + membership in a transaction
    const member = await db.transaction(async (tx) => {
      // Check if person already exists by phone or email
      let person;
      if (normalizedEmail) {
        const [existing] = await tx
          .select()
          .from(people)
          .where(eq(people.email, normalizedEmail))
          .limit(1);
        person = existing;
      }
      if (!person && normalizedPhone) {
        const [existing] = await tx
          .select()
          .from(people)
          .where(eq(people.phone, normalizedPhone))
          .limit(1);
        person = existing;
      }

      // Create person if not found
      if (!person) {
        const [created] = await tx
          .insert(people)
          .values({
            name: validated.name,
            phone: normalizedPhone,
            email: normalizedEmail,
          })
          .returning();
        person = created;
      }

      // Check if membership already exists
      const [existingMembership] = await tx
        .select()
        .from(clientMemberships)
        .where(and(
          eq(clientMemberships.personId, person.id),
          eq(clientMemberships.clientId, validated.clientId)
        ))
        .limit(1);

      if (existingMembership) {
        // Re-activate if inactive, update settings
        const [updated] = await tx
          .update(clientMemberships)
          .set({
            isActive: true,
            receiveEscalations: validated.receiveEscalations,
            receiveHotTransfers: validated.receiveHotTransfers,
            updatedAt: new Date(),
          })
          .where(eq(clientMemberships.id, existingMembership.id))
          .returning();

        return {
          id: updated.id,
          clientId: updated.clientId,
          name: person.name,
          phone: person.phone || '',
          email: person.email,
          role: validated.role || null,
          receiveEscalations: updated.receiveEscalations,
          receiveHotTransfers: updated.receiveHotTransfers,
          priority: updated.priority,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      }

      // Create new membership
      const [membership] = await tx
        .insert(clientMemberships)
        .values({
          personId: person.id,
          clientId: validated.clientId,
          roleTemplateId: defaultRole.id,
          receiveEscalations: validated.receiveEscalations,
          receiveHotTransfers: validated.receiveHotTransfers,
        })
        .returning();

      return {
        id: membership.id,
        clientId: membership.clientId,
        name: person.name,
        phone: person.phone || '',
        email: person.email,
        role: validated.role || null,
        receiveEscalations: membership.receiveEscalations,
        receiveHotTransfers: membership.receiveHotTransfers,
        priority: membership.priority,
        isActive: membership.isActive,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      };
    });

    return Response.json({ success: true, member, teamMember: member });
  } catch (error) {
    console.error('[TeamHours] Team member creation error:', error);
    return Response.json({ error: 'Failed to create team member' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberId = req.nextUrl.searchParams.get('memberId');
    if (!memberId) {
      return Response.json({ error: 'memberId is required' }, { status: 400 });
    }

    // Soft-delete: deactivate the membership instead of hard deleting
    const db = getDb();
    await db
      .update(clientMemberships)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clientMemberships.id, memberId));

    return Response.json({ success: true });
  } catch (error) {
    console.error('[TeamHours] Team member deletion error:', error);
    return Response.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
