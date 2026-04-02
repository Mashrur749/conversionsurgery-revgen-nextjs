import { NextRequest, NextResponse } from 'next/server';
import { runKbGapAutoNotify } from '@/lib/automations/kb-gap-auto-notify';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: notify contractors via SMS when the AI encounters unanswered questions.
 * Runs daily at 10am UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runKbGapAutoNotify();

    console.log(
      `[KbGapAutoNotify] scanned=${result.scanned}, notified=${result.notified}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][kb-gap-notify]', error, 'Processing failed');
  }
}
