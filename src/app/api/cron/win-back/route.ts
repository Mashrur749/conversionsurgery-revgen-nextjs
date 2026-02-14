import { NextRequest, NextResponse } from 'next/server';
import { processWinBacks } from '@/lib/automations/win-back';

/**
 * Cron endpoint: identify stale leads and send win-back messages.
 * Should run daily at 10am.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    console.error('[WinBack] Cron error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
