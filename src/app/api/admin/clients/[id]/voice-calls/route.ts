import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { voiceCalls } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * [Voice] GET /api/admin/clients/[id]/voice-calls
 * Retrieves voice call history for a specific client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CONVERSATIONS_VIEW);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const db = getDb();
  const calls = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.clientId, id))
    .orderBy(desc(voiceCalls.createdAt))
    .limit(50);

  console.log(`[Voice] Retrieved ${calls.length} voice calls for client ${id}`);
  return NextResponse.json(calls);
}
