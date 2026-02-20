import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { scoreClientLeads, getLeadsByTemperature } from '@/lib/services/lead-scoring';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, sql } from 'drizzle-orm';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/clients/[id]/leads/scores - Get score distribution and top hot leads for a client. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

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
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

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
