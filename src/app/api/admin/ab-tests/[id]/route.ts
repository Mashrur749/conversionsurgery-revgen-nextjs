import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { abTests, type NewABTest } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateTestSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  winner: z.enum(['A', 'B']).optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/admin/ab-tests/[id]
 * Retrieves a single A/B test by ID
 */
export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.ABTESTS_MANAGE },
  async ({ params }) => {
    const { id } = params;
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
  }
);

/**
 * PATCH /api/admin/ab-tests/[id]
 * Updates an A/B test (status, winner, end date)
 */
export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.ABTESTS_MANAGE },
  async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();
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
    const updates: Partial<NewABTest> = { updatedAt: new Date() };
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
  }
);
