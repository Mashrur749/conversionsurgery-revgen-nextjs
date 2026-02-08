import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { abTests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateTestSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  winner: z.enum(['A', 'B']).optional(),
  endDate: z.string().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

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
  } catch (error: any) {
    console.error('[AB Tests Get] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch test' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, winner, endDate } = updateTestSchema.parse(body);

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
  } catch (error: any) {
    console.error('[AB Tests Update] Error:', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return Response.json(
      { error: error.message || 'Failed to update test' },
      { status: 500 }
    );
  }
}
