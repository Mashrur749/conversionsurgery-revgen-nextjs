import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { retryInvoicePayment } from '@/lib/services/subscription-invoices';
import { getDb } from '@/db';
import { subscriptionInvoices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** POST /api/client/billing/invoices/[id]/retry — Retry a failed invoice payment */
export const POST = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ session, params }) => {
    const { id } = params;

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
      return safeErrorResponse('[Billing][invoice-retry.post]', error, 'Payment retry failed', 400);
    }
  }
);
