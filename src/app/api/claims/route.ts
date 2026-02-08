import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { escalationClaims, leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/claims
 * Get pending escalation claims for the authenticated user's team
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = (session as any).client?.id;
    if (!clientId) {
      return NextResponse.json({ error: 'No client associated' }, { status: 400 });
    }

    const db = getDb();

    // Get pending escalation claims with lead info
    const claims = await db
      .select({
        id: escalationClaims.id,
        claimToken: escalationClaims.claimToken,
        escalationReason: escalationClaims.escalationReason,
        lastLeadMessage: escalationClaims.lastLeadMessage,
        notifiedAt: escalationClaims.notifiedAt,
        leadId: escalationClaims.leadId,
        leadName: leads.name,
        leadPhone: leads.phone,
      })
      .from(escalationClaims)
      .innerJoin(leads, eq(escalationClaims.leadId, leads.id))
      .where(
        and(
          eq(escalationClaims.clientId, clientId),
          eq(escalationClaims.status, 'pending')
        )
      );

    return NextResponse.json({ claims });
  } catch (error) {
    console.error('[Claims API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}
