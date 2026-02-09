import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scoreClientLeads, getLeadsByTemperature } from '@/lib/services/lead-scoring';
import { getDb, leads } from '@/db';
import { eq, sql } from 'drizzle-orm';

// GET - Get score distribution for client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

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
}

// POST - Batch rescore all leads
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { useAI = false } = await request.json().catch(() => ({}));

  const result = await scoreClientLeads(id, { useAI });

  return NextResponse.json(result);
}
