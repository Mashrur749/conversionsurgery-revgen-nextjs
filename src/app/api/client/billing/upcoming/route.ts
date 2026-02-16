import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { getUpcomingInvoice } from '@/lib/services/subscription-invoices';

/** GET /api/client/billing/upcoming — Preview next invoice amount and date */
export async function GET() {
  const session = await getClientSession();
  if (!session?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upcoming = await getUpcomingInvoice(session.clientId);
  if (!upcoming) {
    return NextResponse.json({ upcoming: null });
  }

  return NextResponse.json({ upcoming });
}
