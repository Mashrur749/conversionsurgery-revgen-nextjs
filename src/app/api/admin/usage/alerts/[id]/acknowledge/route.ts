import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS, getAgencySession } from '@/lib/permissions';
import { acknowledgeAlert } from '@/lib/services/usage-alerts';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/** POST - Acknowledge a usage alert */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const agencySession = await getAgencySession();
    const { id } = await params;
    await acknowledgeAlert(id, agencySession!.personId || agencySession!.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UsageTracking] POST /api/admin/usage/alerts/[id]/acknowledge failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
