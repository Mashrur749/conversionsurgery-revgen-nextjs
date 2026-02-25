import { NextRequest, NextResponse } from 'next/server';
import { processNoShows } from '@/lib/automations/no-show-recovery';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: detect no-show appointments and trigger recovery messages.
 * Should run every 30 minutes.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processNoShows();

    console.log(
      `[NoShowRecovery] Processed: ${result.detected} detected, ${result.messaged} messaged, ${result.errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][no-show-recovery]', error, 'Processing failed');
  }
}
