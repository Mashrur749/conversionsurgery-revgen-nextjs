import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { abTests, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createTestSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  testType: z.enum(['messaging', 'timing', 'team', 'sequence']),
  variantA: z.record(z.string(), z.unknown()),
  variantB: z.record(z.string(), z.unknown()),
});

/**
 * GET /api/admin/ab-tests
 * Retrieves all A/B tests, optionally filtered by client ID
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ABTESTS_MANAGE },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
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
  }
);

/**
 * POST /api/admin/ab-tests
 * Creates a new A/B test for a client
 */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.ABTESTS_MANAGE },
  async ({ request }) => {
    const body = await request.json();
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
        variantA,
        variantB,
        status: 'active',
      })
      .returning();

    return Response.json({
      success: true,
      test: newTest,
      message: `Test "${name}" created for ${client.businessName}`,
    });
  }
);
