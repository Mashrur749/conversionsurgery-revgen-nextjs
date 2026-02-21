import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async ({ request, params }) => {
    const { id } = params;

    const body = (await request.json()) as Record<string, unknown>;

    const data = updateUserSchema.parse(body);

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
