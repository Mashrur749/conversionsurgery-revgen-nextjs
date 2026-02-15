import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leadContext } from '@/db/schema';
import { and, lt, notInArray } from 'drizzle-orm';
import { processScheduledCheck } from '@/lib/agent/orchestrator';
import { verifyCronSecret } from '@/lib/utils/cron';

/**
 * GET handler to check stale leads and trigger AI agent follow-ups.
 * Processes leads not updated in 24 hours that haven't reached terminal stages.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getDb();

  // Find leads that might need follow-up
  const staleLeads = await db
    .select({ leadId: leadContext.leadId })
    .from(leadContext)
    .where(and(
      notInArray(leadContext.stage, ['booked', 'lost', 'escalated']),
      lt(leadContext.updatedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Not updated in 24h
    ))
    .limit(50);

  let processed = 0;

  for (const { leadId } of staleLeads) {
    try {
      const result = await processScheduledCheck(leadId);
      if (result) processed++;
    } catch (error) {
      console.error(`[CronScheduling] Error processing lead ${leadId}:`, error);
    }
  }

  return NextResponse.json({ processed });
}
