import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { NextRequest } from 'next/server';

const teamMemberSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  receiveEscalations: z.boolean().optional().default(true),
  receiveHotTransfers: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return Response.json({ error: 'clientId is required' }, { status: 400 });
    }

    const db = getDb();
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.clientId, clientId));

    return Response.json({ success: true, teamMembers: members });
  } catch (error) {
    console.error('Team members fetch error:', error);
    return Response.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await req.json();
    const validated = teamMemberSchema.parse(data);

    const db = getDb();
    const result = await db
      .insert(teamMembers)
      .values({
        clientId: validated.clientId,
        name: validated.name,
        phone: validated.phone,
        email: validated.email,
        role: validated.role,
        receiveEscalations: validated.receiveEscalations,
        receiveHotTransfers: validated.receiveHotTransfers,
      })
      .returning();

    return Response.json({ success: true, teamMember: result[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation failed', details: error.issues },
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
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
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
