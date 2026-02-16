import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { retryInvoicePayment } from '@/lib/services/subscription-invoices';
import { getDb } from '@/db';
import { subscriptionInvoices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/** POST /api/client/billing/invoices/[id]/retry — Retry a failed invoice payment */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSession();
  if (!session?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const message = error instanceof Error ? error.message : 'Payment retry failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
