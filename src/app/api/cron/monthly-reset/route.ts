import { NextRequest, NextResponse } from 'next/server';
import { getDb, clients } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';
import { applyMonthlyOverages } from '@/lib/services/overage-billing';

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
    const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Only run on the 1st of the month (defensive guard)
    if (now.getDate() !== 1) {
      return NextResponse.json({
        message: 'Not the 1st of the month, skipping',
        timestamp: now.toISOString(),
      });
    }

    // Idempotency guard: only run once per calendar month
    const [lastRun] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'last_monthly_reset_period'))
      .limit(1);

    if (lastRun?.value === periodKey) {
      return NextResponse.json({
        message: 'Monthly reset already processed for this period',
        period: periodKey,
        timestamp: now.toISOString(),
      });
    }

    // Invoice overages for previous month before resetting counters
    const overage = await applyMonthlyOverages(now);

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

    await db
      .insert(systemSettings)
      .values({
        key: 'last_monthly_reset_period',
        value: periodKey,
        description: 'Last calendar period processed for monthly reset and overage billing',
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: periodKey, updatedAt: new Date() },
      });

    return NextResponse.json({
      reset: result.length,
      overage,
      overagePolicy: {
        skippedByPolicy: overage.skippedByPolicy,
        billingDisabledClientsCount: overage.skippedByPolicy,
      },
      period: periodKey,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[MonthlyReset] Failed:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
