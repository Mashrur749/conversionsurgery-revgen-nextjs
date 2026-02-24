import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { runDayOneActivationSlaCheck } from '@/lib/services/day-one-activation';

/** GET /api/cron/onboarding-sla-check - marks overdue day-one milestones and creates operator alerts. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDayOneActivationSlaCheck();
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] onboarding-sla-check failed:', error);
    return NextResponse.json(
      { error: 'Failed to run onboarding SLA check' },
      { status: 500 }
    );
  }
}
