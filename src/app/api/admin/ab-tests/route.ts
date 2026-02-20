import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { abTests, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createTestSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  testType: z.enum(['messaging', 'timing', 'team', 'sequence']),
  variantA: z.record(z.string(), z.any()),
  variantB: z.record(z.string(), z.any()),
});

/**
 * GET /api/admin/ab-tests
 * Retrieves all A/B tests, optionally filtered by client ID
 */
export async function GET(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ABTESTS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return Response.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100);
    const offset = (page - 1) * limit;

    const db = getDb();

    let query = db.select().from(abTests);

    if (clientId) {
      query = query.where(eq(abTests.clientId, clientId)) as typeof query;
    }

    const tests = await (query as typeof query)
      .orderBy(abTests.startDate)
      .limit(limit)
      .offset(offset);

    return Response.json({
      success: true,
      tests,
      count: tests.length,
      page,
      limit,
    });
  } catch (error) {
    console.error('[ABTesting] GET /api/admin/ab-tests error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ab-tests
 * Creates a new A/B test for a client
 */
export async function POST(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ABTESTS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return Response.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createTestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { clientId, name, description, testType, variantA, variantB } = parsed.data;

    const db = getDb();

    // Verify client exists
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Create test
    const [newTest] = await db
      .insert(abTests)
      .values({
        clientId,
        name,
        description,
        testType,
        variantA: variantA as any,
        variantB: variantB as any,
        status: 'active',
      })
      .returning();

    return Response.json({
      success: true,
      test: newTest,
      message: `Test "${name}" created for ${client.businessName}`,
    });
  } catch (error) {
    console.error('[ABTesting] POST /api/admin/ab-tests error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create test' },
      { status: 500 }
    );
  }
}
