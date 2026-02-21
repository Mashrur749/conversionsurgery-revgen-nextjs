import { getDb } from '@/db';
import { coupons, subscriptions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { Coupon } from '@/db/schema/coupons';

interface ValidationResult {
  valid: boolean;
  error?: string;
  discountType?: string;
  discountValue?: number;
  duration?: string;
  durationMonths?: number | null;
}

/**
 * Validate a coupon code against all constraints (read-only — does NOT redeem).
 * Use this for UI preview / price display. For actual redemption, use validateAndRedeemCoupon().
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

  const result = checkCouponConstraints(coupon, planId);
  if (!result.valid) return result;

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
 * Check non-DB coupon constraints (dates, plans, active status).
 */
function checkCouponConstraints(coupon: Coupon, planId: string): ValidationResult {
  if (!coupon.isActive) {
    return { valid: false, error: 'This coupon is no longer active' };
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    return { valid: false, error: 'This coupon is not yet active' };
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false, error: 'This coupon has expired' };
  }

  if (coupon.maxRedemptions && (coupon.timesRedeemed ?? 0) >= coupon.maxRedemptions) {
    return { valid: false, error: 'This coupon has reached its maximum number of uses' };
  }

  if (coupon.applicablePlans && coupon.applicablePlans.length > 0) {
    if (!coupon.applicablePlans.includes(planId)) {
      return { valid: false, error: 'This coupon is not valid for the selected plan' };
    }
  }

  return { valid: true };
}

/**
 * Validate AND atomically redeem a coupon in a single SQL statement.
 * Prevents race conditions where two concurrent requests both pass validation
 * before either increments the counter.
 *
 * The UPDATE...WHERE checks max_redemptions atomically — only one request
 * can increment the counter past the limit.
 */
export async function validateAndRedeemCoupon(
  code: string,
  planId: string,
  clientId: string
): Promise<ValidationResult> {
  const db = getDb();
  const upperCode = code.toUpperCase();

  // First read to get coupon data for non-atomic checks (plan, dates, first-time)
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, upperCode))
    .limit(1);

  if (!coupon) {
    return { valid: false, error: 'Invalid coupon code' };
  }

  const constraintResult = checkCouponConstraints(coupon, planId);
  if (!constraintResult.valid) return constraintResult;

  // Check first-time only
  if (coupon.firstTimeOnly) {
    const [existingSub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.clientId, clientId),
        eq(subscriptions.couponCode, upperCode)
      ))
      .limit(1);

    if (existingSub) {
      return { valid: false, error: 'This coupon can only be used once per client' };
    }
  }

  // Atomic redemption: UPDATE with WHERE that enforces max_redemptions
  // If another request already incremented past the limit, 0 rows are returned.
  const [redeemed] = await db
    .update(coupons)
    .set({ timesRedeemed: sql`coalesce(${coupons.timesRedeemed}, 0) + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(coupons.code, upperCode),
        eq(coupons.isActive, true),
        sql`(${coupons.maxRedemptions} IS NULL OR coalesce(${coupons.timesRedeemed}, 0) < ${coupons.maxRedemptions})`
      )
    )
    .returning();

  if (!redeemed) {
    return { valid: false, error: 'This coupon has reached its maximum number of uses' };
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
 * @deprecated Use validateAndRedeemCoupon() instead for atomic validate+redeem.
 */
export async function redeemCoupon(code: string): Promise<void> {
  const db = getDb();
  await db
    .update(coupons)
    .set({ timesRedeemed: sql`coalesce(${coupons.timesRedeemed}, 0) + 1`, updatedAt: new Date() })
    .where(eq(coupons.code, code.toUpperCase()));
}
