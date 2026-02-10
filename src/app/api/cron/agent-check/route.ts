import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leadContext } from '@/db/schema';
import { and, lt, notInArray } from 'drizzle-orm';
import { processScheduledCheck } from '@/lib/agent/orchestrator';

export async function GET() {
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
      console.error(`Error processing lead ${leadId}:`, error);
    }
  }

  return NextResponse.json({ processed });
}
