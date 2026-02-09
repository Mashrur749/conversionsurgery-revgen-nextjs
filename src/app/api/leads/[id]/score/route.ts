import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scoreLead } from '@/lib/services/lead-scoring';
import { getDb, leads } from '@/db';
import { eq } from 'drizzle-orm';

// GET - Get lead score
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

  const lead = await db
    .select({
      id: leads.id,
      score: leads.score,
      temperature: leads.temperature,
      scoreFactors: leads.scoreFactors,
      scoreUpdatedAt: leads.scoreUpdatedAt,
    })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead.length) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json(lead[0]);
}

// POST - Recalculate score
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { useAI = true } = await request.json().catch(() => ({}));

  const result = await scoreLead(id, { useAI });

  return NextResponse.json(result);
}
