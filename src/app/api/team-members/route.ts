import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb } from '@/db';
import { teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin can pass clientId as query param; regular users use getClientId()
    let clientId: string | null = null;
    if ((session as any).user?.isAdmin) {
      clientId = req.nextUrl.searchParams.get('clientId');
    }
    if (!clientId) {
      clientId = await getClientId();
    }

    if (!clientId) {
      return Response.json({ error: 'No client' }, { status: 403 });
    }

    const db = getDb();
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.clientId, clientId))
      .orderBy(teamMembers.priority);

    return Response.json({ success: true, members, teamMembers: members });
  } catch (error) {
    console.error('Team members fetch error:', error);
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
    const validated = createSchema.parse(data);

    const db = getDb();
    const [member] = await db
      .insert(teamMembers)
      .values({
        clientId: validated.clientId,
        name: validated.name,
        phone: normalizePhoneNumber(validated.phone),
        email: validated.email || null,
        role: validated.role || null,
        receiveEscalations: validated.receiveEscalations,
        receiveHotTransfers: validated.receiveHotTransfers,
      })
      .returning();

    return Response.json({ success: true, member, teamMember: member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Team member creation error:', error);
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

    const db = getDb();
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, memberId));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Team member deletion error:', error);
    return Response.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
