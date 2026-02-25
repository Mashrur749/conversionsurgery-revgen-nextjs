import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getEscalationQueue } from '@/lib/services/escalation';
import { getDb, escalationQueue } from '@/db';
import { eq, and, or, sql } from 'drizzle-orm';
import { safeErrorResponse } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const assignedTo = searchParams.get('assignedTo');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  try {
    const queue = await getEscalationQueue(clientId, {
      status: status || undefined,
      assignedTo: assignedTo || undefined,
    });

    // Get summary counts
    const db = getDb();
    const counts = await db
      .select({
        status: escalationQueue.status,
        count: sql<number>`count(*)`,
      })
      .from(escalationQueue)
      .where(eq(escalationQueue.clientId, clientId))
      .groupBy(escalationQueue.status);

    const summary = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      slaBreached: 0,
    };

    for (const c of counts) {
      if (c.status in summary) {
        summary[c.status as keyof typeof summary] = Number(c.count);
      }
    }

    // Count SLA breaches
    const [breached] = await db
      .select({ count: sql<number>`count(*)` })
      .from(escalationQueue)
      .where(and(
        eq(escalationQueue.clientId, clientId),
        eq(escalationQueue.slaBreach, true),
        or(
          eq(escalationQueue.status, 'pending'),
          eq(escalationQueue.status, 'assigned'),
          eq(escalationQueue.status, 'in_progress')
        )
      ));

    summary.slaBreached = Number(breached?.count || 0);

    return NextResponse.json({ queue, summary });
  } catch (error) {
    return safeErrorResponse('[Escalation API][queue.get]', error, 'Failed to fetch escalation queue');
  }
}
