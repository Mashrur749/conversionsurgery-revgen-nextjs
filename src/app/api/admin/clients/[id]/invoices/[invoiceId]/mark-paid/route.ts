/**
 * POST /api/admin/clients/[id]/invoices/[invoiceId]/mark-paid
 * Admin marks an invoice as paid (for cash, e-transfer, check, etc.)
 */
import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { invoices, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { markInvoicePaid } from '@/lib/automations/payment-reminder';

const markPaidSchema = z.object({
  paymentMethod: z.enum(['cash', 'etransfer', 'check', 'wire', 'stripe', 'other']),
  notes: z.string().max(500).optional(),
  paidAt: z.string().datetime().optional(),
});

export const POST = adminClientRoute<{ id: string; invoiceId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId, session }) => {
    const { invoiceId } = params;

    const db = getDb();

    // Verify invoice exists and belongs to this client
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

    const body = await request.json();
    const data = markPaidSchema.parse(body);

    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

    // Mark invoice as paid (cancels reminders, updates payments)
    await markInvoicePaid(invoiceId, {
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      paidAt,
      recordedBy: session.personId,
    });

    // Write audit log entry
    await db.insert(auditLog).values({
      personId: session.personId,
      clientId,
      action: 'invoice_manually_paid',
      resourceType: 'invoice',
      resourceId: invoiceId,
      metadata: {
        invoiceId,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        paidAt: paidAt.toISOString(),
        recordedBy: session.personId,
      } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, invoiceId });
  }
);
