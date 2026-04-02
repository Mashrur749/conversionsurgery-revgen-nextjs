import { NextRequest, NextResponse } from 'next/server';
import { runKbEmptyNudge } from '@/lib/automations/kb-empty-nudge';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: nudge new clients with < 3 KB entries at the 48-hour mark.
 * Runs daily at 10am UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runKbEmptyNudge();

    console.log(
      `[KbEmptyNudge] scanned=${result.scanned}, nudged=${result.nudged}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][kb-empty-nudge]', error, 'Processing failed');
  }
}
