import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { scoreClientLeads, getLeadsByTemperature } from '@/lib/services/lead-scoring';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, sql } from 'drizzle-orm';

/** GET /api/clients/[id]/leads/scores - Get score distribution and top hot leads for a client. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  try {
    const distribution = await db
      .select({
        temperature: leads.temperature,
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`coalesce(avg(${leads.score})::int, 0)`,
      })
      .from(leads)
      .where(eq(leads.clientId, id))
      .groupBy(leads.temperature);

    const hotLeads = await getLeadsByTemperature(id, 'hot');

    return NextResponse.json({
      distribution,
      hotLeads: hotLeads.slice(0, 10),
    });
  } catch (error) {
    console.error('[LeadManagement] Get score distribution error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/** POST /api/clients/[id]/leads/scores - Batch-rescore all leads for a client. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { useAI?: boolean };
  const { useAI = false } = body;

  try {
    const result = await scoreClientLeads(id, { useAI });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[LeadManagement] Batch rescore error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
