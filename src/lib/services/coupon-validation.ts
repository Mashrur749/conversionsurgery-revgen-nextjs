import { getDb } from '@/db';
import { coupons, subscriptions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface ValidationResult {
  valid: boolean;
  error?: string;
  discountType?: string;
  discountValue?: number;
  duration?: string;
  durationMonths?: number | null;
}

/**
 * Validate a coupon code against all constraints.
 */
export async function validateCoupon(
  code: string,
  planId: string,
  clientId: string
): Promise<ValidationResult> {
  const db = getDb();

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1);

  if (!coupon) {
    return { valid: false, error: 'Invalid coupon code' };
  }

  if (!coupon.isActive) {
    return { valid: false, error: 'This coupon is no longer active' };
  }

  // Check date validity
  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    return { valid: false, error: 'This coupon is not yet active' };
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false, error: 'This coupon has expired' };
  }

  // Check max redemptions
  if (coupon.maxRedemptions && (coupon.timesRedeemed ?? 0) >= coupon.maxRedemptions) {
    return { valid: false, error: 'This coupon has reached its maximum number of uses' };
  }

  // Check applicable plans
  if (coupon.applicablePlans && coupon.applicablePlans.length > 0) {
    if (!coupon.applicablePlans.includes(planId)) {
      return { valid: false, error: 'This coupon is not valid for the selected plan' };
    }
  }

  // Check first-time only
  if (coupon.firstTimeOnly) {
    const [existingSub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.clientId, clientId),
        eq(subscriptions.couponCode, code.toUpperCase())
      ))
      .limit(1);

    if (existingSub) {
      return { valid: false, error: 'This coupon can only be used once per client' };
    }
  }

  return {
    valid: true,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    duration: coupon.duration ?? 'once',
    durationMonths: coupon.durationMonths,
  };
}

/**
 * Increment redemption count after a coupon is used.
 */
export async function redeemCoupon(code: string): Promise<void> {
  const db = getDb();
  await db
    .update(coupons)
    .set({ timesRedeemed: sql`coalesce(${coupons.timesRedeemed}, 0) + 1` })
    .where(eq(coupons.code, code.toUpperCase()));
}
