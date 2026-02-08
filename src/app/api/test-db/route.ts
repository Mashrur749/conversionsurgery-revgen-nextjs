import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();

    // Perform a simple test query
    const result = await db
      .select()
      .from(clients)
      .limit(1);

    return Response.json(
      {
        success: true,
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
        queriedClients: result.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Database test failed:', error);

    return Response.json(
      {
        success: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
