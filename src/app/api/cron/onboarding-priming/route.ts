import { NextRequest, NextResponse } from 'next/server';
import { runOnboardingPriming } from '@/lib/automations/onboarding-priming';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send pre-onboarding priming SMS to new contractors.
 * Fires for clients created 24-48 hours ago. Runs daily at 7am UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runOnboardingPriming();

    console.log(
      `[OnboardingPriming] scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][onboarding-priming]', error, 'Processing failed');
  }
}
