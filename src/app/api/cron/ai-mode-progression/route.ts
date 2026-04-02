import { NextRequest, NextResponse } from 'next/server';
import { runAiModeProgression } from '@/lib/automations/ai-mode-progression';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: auto-advance client AI mode based on time + quality gates.
 * Runs daily at 10am UTC.
 *
 * Progression:
 *   Day 0-6:  off (missed call text-back only)
 *   Day 7+:   assist + smartAssistEnabled (if critical quality gates pass)
 *   Day 14+:  autonomous (if no AI quality flags in past 7 days)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAiModeProgression();

    console.log(
      `[AiModeProgression] processed: ${result.processed}, advanced: ${result.advanced}, skipped: ${result.skipped}, errors: ${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][ai-mode-progression]', error, 'Processing failed');
  }
}
