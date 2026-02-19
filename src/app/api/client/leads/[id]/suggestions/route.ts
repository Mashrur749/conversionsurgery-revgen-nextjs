import { NextRequest, NextResponse } from 'next/server';
import { getDb, suggestedActions, flows } from '@/db';
import { eq, and, desc } from 'drizzle-orm';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.LEADS_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { clientId } = session;

  const { id: leadId } = await params;
  const db = getDb();

  const suggestions = await db
    .select({
      id: suggestedActions.id,
      flowName: flows.name,
      reason: suggestedActions.reason,
      confidence: suggestedActions.confidence,
      status: suggestedActions.status,
      createdAt: suggestedActions.createdAt,
    })
    .from(suggestedActions)
    .innerJoin(flows, eq(suggestedActions.flowId, flows.id))
    .where(and(
      eq(suggestedActions.leadId, leadId),
      eq(suggestedActions.clientId, clientId)
    ))
    .orderBy(desc(suggestedActions.createdAt))
    .limit(10);

  return NextResponse.json({ suggestions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.LEADS_EDIT);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { clientId } = session;

  const { id: leadId } = await params;
  const body = await request.json() as { suggestionId?: string; action?: string };
  const { suggestionId, action } = body;

  if (!suggestionId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const db = getDb();

  if (action === 'approve') {
    await db
      .update(suggestedActions)
      .set({
        status: 'approved',
        respondedAt: new Date(),
        respondedBy: 'crm',
      })
      .where(and(eq(suggestedActions.id, suggestionId), eq(suggestedActions.clientId, clientId)));

    // Get suggestion to start flow
    const [suggestion] = await db
      .select()
      .from(suggestedActions)
      .where(and(eq(suggestedActions.id, suggestionId), eq(suggestedActions.clientId, clientId)))
      .limit(1);

    if (suggestion?.flowId && suggestion.leadId) {
      const { startFlowExecution } = await import('@/lib/services/flow-execution');
      await startFlowExecution(suggestion.flowId, suggestion.leadId, clientId, 'crm');
    }

    return NextResponse.json({ success: true, action: 'approved' });
  } else {
    await db
      .update(suggestedActions)
      .set({
        status: 'rejected',
        respondedAt: new Date(),
        respondedBy: 'crm',
      })
      .where(and(eq(suggestedActions.id, suggestionId), eq(suggestedActions.clientId, clientId)));

    return NextResponse.json({ success: true, action: 'rejected' });
  }
}
