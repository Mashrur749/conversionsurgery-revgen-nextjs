import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
    const body = (await request.json()) as Record<string, unknown>;

    const db = getDb();
    const [updated] = await db
      .update(teamMembers)
      .set({ ...body, updatedAt: new Date() } as Partial<typeof teamMembers.$inferInsert>)
      .where(eq(teamMembers.id, id))
      .returning();

    if (!updated) {
      return Response.json({ error: 'Team member not found' }, { status: 404 });
    }

    return Response.json({ success: true, member: updated });
  } catch (error) {
    console.error('Team member update error:', error);
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
    console.error('Team member deletion error:', error);
    return Response.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
