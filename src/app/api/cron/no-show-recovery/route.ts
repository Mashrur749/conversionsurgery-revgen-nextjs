import { NextRequest, NextResponse } from 'next/server';
import { processNoShows } from '@/lib/automations/no-show-recovery';

/**
 * Cron endpoint: detect no-show appointments and trigger recovery messages.
 * Should run every 30 minutes.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    console.error('[NoShowRecovery] Cron error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
