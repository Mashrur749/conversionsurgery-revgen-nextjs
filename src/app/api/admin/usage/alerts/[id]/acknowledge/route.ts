import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { acknowledgeAlert } from '@/lib/services/usage-alerts';

/** POST - Acknowledge a usage alert */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await acknowledgeAlert(id, (session as any).user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UsageTracking] POST /api/admin/usage/alerts/[id]/acknowledge failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
