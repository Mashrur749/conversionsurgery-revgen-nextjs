import { NextRequest, NextResponse } from 'next/server';
import { getDb, calendarIntegrations } from '@/db';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { fullSync } from '@/lib/services/calendar';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/** GET /api/cron/calendar-sync - Cron job to sync all active calendar integrations */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get integrations that need sync (not synced in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const needsSync = await db
      .select({
        clientId: calendarIntegrations.clientId,
      })
      .from(calendarIntegrations)
      .where(
        and(
          eq(calendarIntegrations.isActive, true),
          eq(calendarIntegrations.syncEnabled, true),
          or(
            isNull(calendarIntegrations.lastSyncAt),
            lt(calendarIntegrations.lastSyncAt, fifteenMinutesAgo)
          )
        )
      )
      .groupBy(calendarIntegrations.clientId);

    let synced = 0;
    let errors = 0;

    for (const { clientId } of needsSync) {
      try {
        await fullSync(clientId);
        synced++;
      } catch (err) {
        logSanitizedConsoleError('[Calendar Sync Cron] Sync failed:', err, { clientId });
        errors++;
      }
    }

    return NextResponse.json({
      synced,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return safeErrorResponse('[Cron][calendar-sync]', error, 'Calendar sync failed');
  }
}
