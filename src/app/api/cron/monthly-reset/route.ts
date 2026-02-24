import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { runMonthlyResetCatchup } from '@/lib/services/monthly-reset-job';

/**
 * Monthly reset cron with cursor-based catch-up semantics.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const catchup = await runMonthlyResetCatchup();
    return NextResponse.json({ success: true, catchup });
  } catch (error) {
    console.error('[MonthlyReset] Failed:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
