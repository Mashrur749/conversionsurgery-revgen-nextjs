import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { coupons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateCouponSchema = z.object({
  name: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
}).strict();

/** PATCH /api/admin/coupons/[id] — Update a coupon */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.maxRedemptions !== undefined) updates.maxRedemptions = parsed.data.maxRedemptions;
  if (parsed.data.validUntil !== undefined) {
    updates.validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;
  }

  const [updated] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
  if (!updated) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
  }

  return NextResponse.json({ coupon: updated });
}

/** DELETE /api/admin/coupons/[id] — Delete a coupon */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;
  const db = getDb();
  const [deleted] = await db.delete(coupons).where(eq(coupons.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
