import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { takeOverConversation } from '@/lib/services/escalation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json() as { teamMemberId?: string };
    const { teamMemberId } = body;

    if (!teamMemberId) {
      return NextResponse.json({ error: 'teamMemberId required' }, { status: 400 });
    }

    await takeOverConversation(id, teamMemberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Escalation API] Error taking over:', error);
    return NextResponse.json({ error: 'Failed to take over conversation' }, { status: 500 });
  }
}
