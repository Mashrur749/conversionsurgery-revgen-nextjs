/**
 * POST /api/client/invoices/[invoiceId]/mark-paid
 * Portal: contractor marks an invoice as paid (cash, check, bank transfer, etc.)
 */
import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { markInvoicePaid } from '@/lib/automations/payment-reminder';

const markPaidSchema = z
  .object({
    paymentMethod: z.enum(['cash', 'check', 'bank_transfer', 'other']).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

export const POST = portalRoute<{ invoiceId: string }>(
  { permission: PORTAL_PERMISSIONS.REVENUE_VIEW },
  async ({ request, session, params }) => {
    const { clientId } = session;
    const { invoiceId } = params;

    const db = getDb();

    // Verify the invoice exists and belongs to this client
    const [invoice] = await db
      .select({ id: invoices.id, status: invoices.status, clientId: invoices.clientId })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.clientId, clientId)))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    const body = (await request.json()) as unknown;
    const parsed = markPaidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Mark invoice as paid — cancels pending payment_reminder scheduled messages
    await markInvoicePaid(invoiceId, {
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes,
      paidAt: new Date(),
    });

    return NextResponse.json({ success: true, invoiceId });
  }
);
