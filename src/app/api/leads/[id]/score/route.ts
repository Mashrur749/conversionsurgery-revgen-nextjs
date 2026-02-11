import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scoreLead } from '@/lib/services/lead-scoring';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq } from 'drizzle-orm';

/** GET /api/leads/[id]/score - Retrieve the current score and factors for a lead. */
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

  try {
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
  } catch (error) {
    console.error('[LeadManagement] Get lead score error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/** POST /api/leads/[id]/score - Recalculate and persist the score for a lead. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { useAI?: boolean };
  const { useAI = true } = body;

  try {
    const result = await scoreLead(id, { useAI });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[LeadManagement] Recalculate lead score error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
