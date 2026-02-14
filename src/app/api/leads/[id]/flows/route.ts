import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { flowExecutions, flows } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

/** GET /api/leads/[id]/flows - Get active flow executions for a lead. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const executions = await db
    .select({
      id: flowExecutions.id,
      flowName: flows.name,
      category: flows.category,
      status: flowExecutions.status,
      currentStep: flowExecutions.currentStep,
      totalSteps: flowExecutions.totalSteps,
      startedAt: flowExecutions.startedAt,
      nextStepAt: flowExecutions.nextStepAt,
    })
    .from(flowExecutions)
    .leftJoin(flows, eq(flowExecutions.flowId, flows.id))
    .where(and(
      eq(flowExecutions.leadId, id),
      or(
        eq(flowExecutions.status, 'active'),
        eq(flowExecutions.status, 'paused')
      )
    ))
    .orderBy(flowExecutions.startedAt);

  return NextResponse.json({ executions });
}
