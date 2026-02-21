import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { acknowledgeAlert } from '@/lib/services/usage-alerts';

/** POST - Acknowledge a usage alert */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.BILLING_VIEW },
  async ({ session, params }) => {
    const { id } = params;
    await acknowledgeAlert(id, session.personId || session.userId);

    return NextResponse.json({ success: true });
  }
);
