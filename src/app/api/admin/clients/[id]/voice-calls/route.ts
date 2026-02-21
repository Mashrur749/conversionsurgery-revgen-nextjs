import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { voiceCalls } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * [Voice] GET /api/admin/clients/[id]/voice-calls
 * Retrieves voice call history for a specific client
 */
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const calls = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.clientId, clientId))
      .orderBy(desc(voiceCalls.createdAt))
      .limit(50);

    console.log(`[Voice] Retrieved ${calls.length} voice calls for client ${clientId}`);
    return NextResponse.json(calls);
  }
);
