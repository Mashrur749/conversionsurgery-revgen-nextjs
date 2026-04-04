import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb, voiceCalls } from '@/db';
import { clients } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

/** GET /api/client/voice-status */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session }) => {
    const { clientId } = session;
    const db = getDb();

    const [clientRow] = await db
      .select({
        voiceEnabled: clients.voiceEnabled,
        voiceMode: clients.voiceMode,
        twilioNumber: clients.twilioNumber,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!clientRow) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [weekStats] = await db
      .select({
        totalCalls: sql<number>`COUNT(*)`,
        booked: sql<number>`COUNT(*) FILTER (WHERE ${voiceCalls.outcome} = 'scheduled')`,
        transferred: sql<number>`COUNT(*) FILTER (WHERE ${voiceCalls.outcome} = 'transferred')`,
      })
      .from(voiceCalls)
      .where(
        and(
          eq(voiceCalls.clientId, clientId),
          gte(voiceCalls.createdAt, startOfWeek)
        )
      );

    return NextResponse.json({
      voiceEnabled: clientRow.voiceEnabled ?? false,
      voiceMode: clientRow.voiceMode ?? 'after_hours',
      twilioNumber: clientRow.twilioNumber ?? null,
      thisWeek: {
        totalCalls: Number(weekStats?.totalCalls ?? 0),
        booked: Number(weekStats?.booked ?? 0),
        transferred: Number(weekStats?.transferred ?? 0),
      },
    });
  }
);
