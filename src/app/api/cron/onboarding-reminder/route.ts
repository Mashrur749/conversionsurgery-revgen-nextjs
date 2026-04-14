import { NextRequest, NextResponse } from 'next/server';
import { runOnboardingReminder } from '@/lib/automations/onboarding-reminder';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send reminder SMS to contractors 2 hours before their onboarding call.
 * Runs every 30 minutes.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runOnboardingReminder();

    console.log(
      `[OnboardingReminder] scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][onboarding-reminder]', error, 'Processing failed');
  }
}
