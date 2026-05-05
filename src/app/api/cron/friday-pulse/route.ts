import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendFridayPulses } from '@/lib/services/friday-pulse';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Friday Pulse SMS — fires every Friday at 4:00pm in each client's local
 * timezone. The service self-gates by timezone, so it is safe to dispatch
 * from the every-5-minute cron window; clients outside the Friday 16:00–16:04
 * local window are skipped.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendFridayPulses();
    return NextResponse.json(result);
  } catch (error) {
    return safeErrorResponse('[Cron][friday-pulse]', error, 'Friday Pulse failed');
  }
}
