import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { checkAiQualityDegradation } from '@/lib/services/ai-quality-alert';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await checkAiQualityDegradation();
    return NextResponse.json(result);
  } catch (error) {
    logSanitizedConsoleError('[Cron] AI quality alert check failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
