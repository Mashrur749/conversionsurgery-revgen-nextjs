import { NextRequest, NextResponse } from 'next/server';
import { expirePendingPrompts } from '@/lib/services/agency-communication';
import { verifyCronSecret } from '@/lib/utils/cron';

/**
 * Hourly cron to expire pending action prompts that have passed their expiresAt.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expired = await expirePendingPrompts();
    return NextResponse.json({ success: true, expired });
  } catch (error) {
    console.error('[Cron] Expire prompts error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
