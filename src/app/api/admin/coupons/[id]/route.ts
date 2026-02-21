import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { coupons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logDeleteAudit } from '@/lib/services/audit';

const updateCouponSchema = z.object({
  name: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
}).strict();

/** PATCH /api/admin/coupons/[id] — Update a coupon */
export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.BILLING_MANAGE },
  async ({ request, params }) => {
    const { id } = params;
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

    const [updated] = await db.update(coupons).set({ ...updates, updatedAt: new Date() }).where(eq(coupons.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    return NextResponse.json({ coupon: updated });
  }
);

/** DELETE /api/admin/coupons/[id] — Delete or deactivate a coupon (B8) */
export const DELETE = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.BILLING_MANAGE },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();

    // Check if coupon exists and has been redeemed
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    // If redeemed, soft-delete (deactivate) instead of hard-delete to preserve audit trail
    if (coupon.timesRedeemed && coupon.timesRedeemed > 0) {
      await db.update(coupons).set({ isActive: false, updatedAt: new Date() }).where(eq(coupons.id, id));
      return NextResponse.json({ success: true, softDeleted: true });
    }

    // Never redeemed — safe to hard-delete
    await db.delete(coupons).where(eq(coupons.id, id));
    await logDeleteAudit({ resourceType: 'coupon', resourceId: id, metadata: { code: coupon.code, name: coupon.name } });
    return NextResponse.json({ success: true });
  }
);
