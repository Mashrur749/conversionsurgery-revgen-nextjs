import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { acknowledgeAlert } from '@/lib/services/usage-alerts';

/** POST - Acknowledge a usage alert */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await acknowledgeAlert(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UsageTracking] POST /api/admin/usage/alerts/[id]/acknowledge failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
