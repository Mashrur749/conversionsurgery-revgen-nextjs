import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { abTests, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const createTestSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  testType: z.enum(['messaging', 'timing', 'team', 'sequence']),
  variantA: z.record(z.string(), z.any()),
  variantB: z.record(z.string(), z.any()),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    const db = getDb();

    let query = db.select().from(abTests);

    if (clientId) {
      query = query.where(eq(abTests.clientId, clientId)) as any;
    }

    const tests = await (query as any).orderBy(abTests.startDate);

    return Response.json({
      success: true,
      tests,
      count: tests.length,
    });
  } catch (error: any) {
    console.error('[AB Tests List] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const {
      clientId,
      name,
      description,
      testType,
      variantA,
      variantB,
    } = createTestSchema.parse(body);

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
  } catch (error: any) {
    console.error('[AB Tests Create] Error:', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return Response.json(
      { error: error.message || 'Failed to create test' },
      { status: 500 }
    );
  }
}
