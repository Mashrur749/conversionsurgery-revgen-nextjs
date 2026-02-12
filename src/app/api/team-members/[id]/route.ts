import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  role: z.string().optional(),
  receiveEscalations: z.boolean().optional(),
  receiveHotTransfers: z.boolean().optional(),
  priority: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();
    const [updated] = await db
      .update(teamMembers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(teamMembers.id, id))
      .returning();

    if (!updated) {
      return Response.json({ error: 'Team member not found' }, { status: 404 });
    }

    return Response.json({ success: true, member: updated });
  } catch (error) {
    console.error('[TeamHours] Team member update error:', error);
    return Response.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const db = getDb();
    await db.delete(teamMembers).where(eq(teamMembers.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error('[TeamHours] Team member deletion error:', error);
    return Response.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
