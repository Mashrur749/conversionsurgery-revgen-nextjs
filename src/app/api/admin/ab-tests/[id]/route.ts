import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { abTests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safeErrorResponse, permissionErrorResponse } from '@/lib/utils/api-errors';

const updateTestSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  winner: z.enum(['A', 'B']).optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/admin/ab-tests/[id]
 * Retrieves a single A/B test by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ABTESTS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const { id } = await params;
    const db = getDb();

    const [test] = await db
      .select()
      .from(abTests)
      .where(eq(abTests.id, id))
      .limit(1);

    if (!test) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    return Response.json({ success: true, test });
  } catch (error) {
    return safeErrorResponse('[ABTesting] GET /api/admin/ab-tests/[id] error:', error, 'Failed to fetch test');
  }
}

/**
 * PATCH /api/admin/ab-tests/[id]
 * Updates an A/B test (status, winner, end date)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ABTESTS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateTestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status, winner, endDate } = parsed.data;

    const db = getDb();

    // Verify test exists
    const [test] = await db
      .select()
      .from(abTests)
      .where(eq(abTests.id, id))
      .limit(1);

    if (!test) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    // Update test
    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (winner) updates.winner = winner;
    if (endDate) updates.endDate = new Date(endDate);

    const [updatedTest] = await db
      .update(abTests)
      .set(updates)
      .where(eq(abTests.id, id))
      .returning();

    return Response.json({
      success: true,
      test: updatedTest,
      message: `Test updated: status=${status || test.status}, winner=${winner || 'none'}`,
    });
  } catch (error) {
    return safeErrorResponse('[ABTesting] PATCH /api/admin/ab-tests/[id] error:', error, 'Failed to update test');
  }
}
