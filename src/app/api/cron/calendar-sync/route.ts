import { NextRequest, NextResponse } from 'next/server';
import { getDb, calendarIntegrations } from '@/db';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { fullSync } from '@/lib/services/calendar';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
      if (!clientId) continue;

      try {
        await fullSync(clientId);
        synced++;
      } catch (err) {
        console.error(`Calendar sync failed for client ${clientId}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      synced,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Calendar sync cron error:', error);
    return NextResponse.json(
      { error: 'Calendar sync failed' },
      { status: 500 }
    );
  }
}
