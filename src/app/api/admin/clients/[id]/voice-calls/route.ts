import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { voiceCalls } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * [Voice] GET /api/admin/clients/[id]/voice-calls
 * Retrieves voice call history for a specific client (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    console.log('[Voice] Unauthorized access attempt to voice calls');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
