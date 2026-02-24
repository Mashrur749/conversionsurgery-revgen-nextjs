import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { rollupVoiceUsageAddonEvents } from '@/lib/services/addon-billing-ledger';

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await rollupVoiceUsageAddonEvents();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron][VoiceUsageRollup] Failed:', error);
    return NextResponse.json({ error: 'Voice usage rollup failed' }, { status: 500 });
  }
}
