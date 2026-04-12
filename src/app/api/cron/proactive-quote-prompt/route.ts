import { NextRequest, NextResponse } from 'next/server';
import { runProactiveQuotePrompt } from '@/lib/automations/proactive-quote-prompt';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send one-time &quot;Did you send a quote?&quot; SMS to contractors
 * for leads that have been in `new` or `contacted` status for 3+ days with no
 * estimate follow-up sequence started.
 * Runs daily at 10am UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runProactiveQuotePrompt();

    console.log(
      `[ProactiveQuotePrompt] Processed: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][proactive-quote-prompt]', error, 'Processing failed');
  }
}
