import { NextRequest, NextResponse } from 'next/server';
import { nudgeProbableWins } from '@/lib/automations/probable-wins-nudge';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send won/lost nudge SMS to contractors for leads with
 * completed appointments that are still unresolved (14+ days old).
 * Runs weekly on Mondays at 10am UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await nudgeProbableWins();

    console.log(
      `[ProbableWinsNudge] Processed: ${result.nudged} nudged, ${result.skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][probable-wins-nudge]', error, 'Processing failed');
  }
}
