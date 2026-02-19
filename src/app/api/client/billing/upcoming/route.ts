import { NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { getUpcomingInvoice } from '@/lib/services/subscription-invoices';

/** GET /api/client/billing/upcoming — Preview next invoice amount and date */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.SETTINGS_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const upcoming = await getUpcomingInvoice(session.clientId);
  if (!upcoming) {
    return NextResponse.json({ upcoming: null });
  }

  return NextResponse.json({ upcoming });
}
