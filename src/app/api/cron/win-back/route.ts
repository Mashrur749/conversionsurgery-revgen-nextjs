import { NextRequest, NextResponse } from 'next/server';
import { processWinBacks } from '@/lib/automations/win-back';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: identify stale leads and send win-back messages.
 * Should run daily at 10am.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processWinBacks();

    console.log(
      `[WinBack] Processed: ${result.eligible} eligible, ${result.messaged} messaged, ${result.markedDormant} dormant, ${result.errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][win-back]', error, 'Processing failed');
  }
}
