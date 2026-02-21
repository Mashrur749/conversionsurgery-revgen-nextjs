import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  clientId: z.string().uuid().optional().or(z.null()),
});

export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async ({ request, session, params }) => {
    const { id } = params;

    const body = (await request.json()) as Record<string, unknown>;

    const data = updateUserSchema.parse(body);

    // Prevent self-demotion: admin cannot remove their own admin access
    if (data.isAdmin === false && session.userId === id) {
      return NextResponse.json(
        { error: 'Cannot remove your own admin access' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  }
);
