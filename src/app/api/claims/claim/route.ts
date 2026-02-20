import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { claimEscalation } from '@/lib/services/team-escalation';
import { getTeamMembers } from '@/lib/services/team-bridge';

/**
 * POST /api/claims/claim
 * Claim an escalation using a claim token and team member ID
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json() as { token?: string };

    if (!token) {
      return NextResponse.json({ error: 'Claim token required' }, { status: 400 });
    }

    // Get current user's team member ID
    const clientId = session.client?.id;

    if (!clientId) {
      return NextResponse.json({ error: 'No client associated' }, { status: 403 });
    }

    const clientMembers = await getTeamMembers(clientId);
    const userTeamMember = clientMembers[0];

    if (!userTeamMember) {
      return NextResponse.json(
        { error: 'Not a team member for this client' },
        { status: 403 }
      );
    }

    // Claim the escalation
    const result = await claimEscalation(token, userTeamMember.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Claims Claim API] Error:', error);
    return NextResponse.json({ error: 'Failed to claim escalation' }, { status: 500 });
  }
}
