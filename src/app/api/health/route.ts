import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { cronJobCursors } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Public health check endpoint — no auth required.
 * External monitors (Cloudflare, BetterUptime, Cronitor) ping this every 5 min.
 *
 * Checks the heartbeat_check cron cursor to verify the platform is alive.
 * Returns 200 if healthy, 503 if degraded.
 */
export async function GET() {
  try {
    const db = getDb();
    const [cursor] = await db
      .select({
        lastRunAt: cronJobCursors.lastRunAt,
        status: cronJobCursors.status,
      })
      .from(cronJobCursors)
      .where(eq(cronJobCursors.jobKey, 'heartbeat_check'))
      .limit(1);

    if (!cursor || !cursor.lastRunAt) {
      return NextResponse.json(
        { status: 'degraded', issue: 'heartbeat never ran', lastHeartbeat: null },
        { status: 503 }
      );
    }

    const ageMs = Date.now() - new Date(cursor.lastRunAt).getTime();
    const maxAgeMs = 26 * 60 * 60 * 1000; // 26 hours (same buffer as heartbeat check)

    if (ageMs > maxAgeMs) {
      return NextResponse.json(
        {
          status: 'degraded',
          issue: 'heartbeat stale',
          lastHeartbeat: cursor.lastRunAt.toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      lastHeartbeat: cursor.lastRunAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'degraded', issue: 'db unreachable' },
      { status: 503 }
    );
  }
}
