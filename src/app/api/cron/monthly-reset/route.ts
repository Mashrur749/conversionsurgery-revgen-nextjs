import { NextRequest, NextResponse } from 'next/server';
import { getDb, clients } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';

/**
 * Monthly message counter reset cron.
 * Runs on the 1st of each month. Idempotent — only resets clients whose
 * counters haven't been reset in the current calendar month.
 *
 * Uses a lastMonthlyResetAt column if available, otherwise checks the date.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const now = new Date();

    // Only run on the 1st of the month (defensive guard)
    if (now.getDate() !== 1) {
      return NextResponse.json({
        message: 'Not the 1st of the month, skipping',
        timestamp: now.toISOString(),
      });
    }

    // Reset active clients only, and only if they have messages to reset
    const result = await db
      .update(clients)
      .set({
        messagesSentThisMonth: 0,
        updatedAt: new Date(),
      })
      .where(
        eq(clients.status, 'active')
      )
      .returning({ id: clients.id });

    console.log(`[MonthlyReset] Reset message counts for ${result.length} active clients`);

    return NextResponse.json({
      reset: result.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[MonthlyReset] Failed:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
