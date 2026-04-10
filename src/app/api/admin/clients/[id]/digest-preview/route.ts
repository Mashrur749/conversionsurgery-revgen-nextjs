import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getWeeklyStats, buildDigestMessage, DigestStats } from '@/lib/services/weekly-digest';

export type DigestMessageType = 'active' | 'quiet' | 'reassurance' | 'skip';

interface DigestPreviewResponse {
  message: string;
  stats: DigestStats;
  messageType: DigestMessageType;
}

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();

    const [client] = await db
      .select({
        ownerName: clients.ownerName,
        weeklyDigestConsecutiveZeroWeeks: clients.weeklyDigestConsecutiveZeroWeeks,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const stats = await getWeeklyStats(clientId);

    const hasAnyActivity = stats.newLeads > 0 || stats.appointmentsBooked > 0;
    const hasFollowUps = stats.estimatesInFollowUp > 0;

    // Determine if digest would be skipped (zero everything, no follow-ups)
    if (!hasAnyActivity && !hasFollowUps) {
      const response: DigestPreviewResponse = {
        message: '',
        stats,
        messageType: 'skip',
      };
      return NextResponse.json(response);
    }

    const consecutiveZeroWeeks = client.weeklyDigestConsecutiveZeroWeeks ?? 0;
    const { body, type } = buildDigestMessage(client.ownerName, stats, consecutiveZeroWeeks);

    const response: DigestPreviewResponse = {
      message: body,
      stats,
      messageType: type,
    };

    return NextResponse.json(response);
  }
);
