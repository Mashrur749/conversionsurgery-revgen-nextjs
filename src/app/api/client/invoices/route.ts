/**
 * GET  /api/client/invoices — list invoices for the authenticated portal client
 * POST /api/client/invoices — create a new invoice linked to a lead
 */
import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { invoices, leads } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.REVENUE_VIEW },
  async ({ session }) => {
    const { clientId } = session;
    const db = getDb();

    const rows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.clientId, clientId))
      .orderBy(desc(invoices.createdAt));

    return NextResponse.json({ invoices: rows });
  }
);

// ─── POST ─────────────────────────────────────────────────────────────────────

const createInvoiceSchema = z
  .object({
    leadId: z.string().uuid(),
    description: z.string().max(1000).optional(),
    totalAmountCents: z.number().int().positive(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD'),
    milestoneType: z.enum(['standard', 'deposit', 'progress', 'final']).optional(),
    jobId: z.string().uuid().optional(),
  })
  .strict();

export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.REVENUE_VIEW },
  async ({ request, session }) => {
    const { clientId } = session;
    const db = getDb();

    const body = (await request.json()) as unknown;
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { leadId, description, totalAmountCents, dueDate, milestoneType, jobId } = parsed.data;

    // Verify the lead exists and belongs to this client
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const invoiceNumber = `INV-${Date.now()}`;

    const [created] = await db
      .insert(invoices)
      .values({
        clientId,
        leadId,
        jobId: jobId ?? null,
        invoiceNumber,
        description: description ?? null,
        totalAmount: totalAmountCents,
        paidAmount: 0,
        remainingAmount: totalAmountCents,
        dueDate,
        status: 'pending',
        milestoneType: milestoneType ?? 'standard',
      })
      .returning();

    return NextResponse.json({ invoice: created }, { status: 201 });
  }
);
