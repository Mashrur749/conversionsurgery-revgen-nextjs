import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processLoggingGate } from '@/lib/automations/guarantee-gates';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/guarantee-30day — daily check for logging compliance gate */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await processLoggingGate();
    const met = results.filter((r) => r.action === 'met').length;
    const paused = results.filter((r) => r.action === 'paused').length;
    const resumed = results.filter((r) => r.action === 'resumed').length;
    const deferred = results.filter((r) => r.action === 'deferred_low_volume').length;

    return NextResponse.json({
      success: true,
      checked: results.length,
      met,
      paused,
      resumed,
      deferred,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][guarantee-30day]', error, 'Failed');
  }
}
