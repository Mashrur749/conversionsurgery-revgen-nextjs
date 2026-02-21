import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getUpcomingInvoice } from '@/lib/services/subscription-invoices';

/** GET /api/client/billing/upcoming — Preview next invoice amount and date */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session }) => {
    const upcoming = await getUpcomingInvoice(session.clientId);
    if (!upcoming) {
      return NextResponse.json({ upcoming: null });
    }

    return NextResponse.json({ upcoming });
  }
);
