import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { runMonthlyResetCatchup } from '@/lib/services/monthly-reset-job';
import { safeErrorResponse } from '@/lib/utils/api-errors';

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
    return safeErrorResponse('[Cron][monthly-reset]', error, 'Reset failed');
  }
}
