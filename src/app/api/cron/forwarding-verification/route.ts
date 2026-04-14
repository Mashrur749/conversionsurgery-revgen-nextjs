import { NextRequest, NextResponse } from 'next/server';
import { runForwardingVerificationCron } from '@/lib/automations/forwarding-verification-cron';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: verify call forwarding for new clients (FMA 4.5).
 * Runs daily at 10am UTC for clients in their first 7 days of signup.
 * Skips clients that have already passed, been skipped, or been called today.
 * Enforces business-hours gate (10am–4pm in client's local timezone).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runForwardingVerificationCron();

    console.log(
      `[ForwardingVerification] processed=${result.processed}, skipped=${result.skipped}, errors=${result.errors}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][forwarding-verification]', error, 'Processing failed');
  }
}
