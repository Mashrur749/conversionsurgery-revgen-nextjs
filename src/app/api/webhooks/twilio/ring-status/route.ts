import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { callAttempts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * [Voice] Twilio status callback for outbound ring group calls.
 *
 * Twilio posts CallStatus events (initiated, ringing, answered, completed)
 * to this URL when the outer call leg changes state. The attemptId query
 * param identifies which callAttempts row to update.
 *
 * Returns a plain 204 — Twilio does not expect TwiML from status callbacks.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return new NextResponse(null, { status: 400 });
    }

    const url = new URL(request.url);
    const attemptId = url.searchParams.get('attemptId');

    if (!attemptId) {
      return new NextResponse(null, { status: 204 });
    }

    const callStatus = payload.CallStatus as string | undefined;
    if (!callStatus) {
      return new NextResponse(null, { status: 204 });
    }

    // Map Twilio CallStatus values to our internal status column
    const statusMap: Record<string, string> = {
      initiated: 'initiated',
      ringing: 'ringing',
      answered: 'answered',
      completed: 'answered',
      'no-answer': 'no-answer',
      busy: 'no-answer',
      failed: 'failed',
      canceled: 'failed',
    };

    const internalStatus = statusMap[callStatus];
    if (!internalStatus) {
      return new NextResponse(null, { status: 204 });
    }

    const db = getDb();
    await db
      .update(callAttempts)
      .set({
        status: internalStatus,
        ...(callStatus === 'completed' || callStatus === 'answered'
          ? { endedAt: new Date() }
          : {}),
      })
      .where(eq(callAttempts.id, attemptId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    void logInternalError({
      source: '[Voice] Ring status callback',
      error,
      context: { route: '/api/webhooks/twilio/ring-status' },
    });
    logSanitizedConsoleError('[Voice] Ring status callback failed', error, {
      route: '/api/webhooks/twilio/ring-status',
    });
    return new NextResponse(null, { status: 204 });
  }
}
