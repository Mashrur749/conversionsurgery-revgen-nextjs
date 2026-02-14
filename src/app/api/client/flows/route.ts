import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { getDb } from '@/db';
import { flows } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/client/flows - List all flows assigned to the authenticated client. */
export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const clientFlows = await db
    .select({
      id: flows.id,
      name: flows.name,
      description: flows.description,
      category: flows.category,
      trigger: flows.trigger,
      isActive: flows.isActive,
      priority: flows.priority,
      createdAt: flows.createdAt,
    })
    .from(flows)
    .where(eq(flows.clientId, session.clientId))
    .orderBy(flows.priority);

  return NextResponse.json({ flows: clientFlows });
}
