import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';
import type { AgencySession } from '@/lib/permissions';

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  clientId: z.string().uuid().optional().or(z.null()),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session: AgencySession;
  try {
    session = await requireAgencyPermission(AGENCY_PERMISSIONS.TEAM_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;

  try {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    return safeErrorResponse('PATCH /api/admin/users/[id]', error, 'Failed to update user');
  }
}
