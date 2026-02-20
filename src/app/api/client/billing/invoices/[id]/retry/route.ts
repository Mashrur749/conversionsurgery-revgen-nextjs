import { NextRequest, NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { retryInvoicePayment } from '@/lib/services/subscription-invoices';
import { getDb } from '@/db';
import { subscriptionInvoices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/** POST /api/client/billing/invoices/[id]/retry — Retry a failed invoice payment */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.SETTINGS_EDIT);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Verify invoice belongs to this client's subscription
  const db = getDb();
  const [invoice] = await db
    .select()
    .from(subscriptionInvoices)
    .where(and(
      eq(subscriptionInvoices.id, id),
      eq(subscriptionInvoices.clientId, session.clientId)
    ))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  try {
    const updated = await retryInvoicePayment(id);
    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    console.error('[Billing] Invoice retry error:', error);
    return NextResponse.json({ error: 'Payment retry failed' }, { status: 400 });
  }
}
