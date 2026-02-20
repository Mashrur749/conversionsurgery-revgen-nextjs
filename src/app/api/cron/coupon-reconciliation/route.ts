import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { coupons, subscriptions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';

/**
 * Daily coupon redemption count reconciliation cron.
 * Compares timesRedeemed counter against actual subscription count per coupon code
 * and fixes any drift.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get actual redemption counts from subscriptions table
    const actualCounts = await db
      .select({
        couponCode: subscriptions.couponCode,
        actualCount: sql<number>`COUNT(*)`,
      })
      .from(subscriptions)
      .where(sql`${subscriptions.couponCode} IS NOT NULL`)
      .groupBy(subscriptions.couponCode);

    // Get all coupons with their current timesRedeemed
    const allCoupons = await db.select({
      id: coupons.id,
      code: coupons.code,
      timesRedeemed: coupons.timesRedeemed,
    }).from(coupons);

    // Build lookup of actual counts
    const countMap = new Map<string, number>();
    for (const row of actualCounts) {
      if (row.couponCode) {
        countMap.set(row.couponCode, Number(row.actualCount));
      }
    }

    let fixed = 0;
    const discrepancies: { code: string; was: number; now: number }[] = [];

    for (const coupon of allCoupons) {
      const actual = countMap.get(coupon.code) ?? 0;
      const current = coupon.timesRedeemed ?? 0;

      if (actual !== current) {
        await db
          .update(coupons)
          .set({
            timesRedeemed: actual,
          })
          .where(eq(coupons.id, coupon.id));

        discrepancies.push({ code: coupon.code, was: current, now: actual });
        fixed++;
      }
    }

    if (discrepancies.length > 0) {
      console.warn('[CouponReconciliation] Fixed discrepancies:', discrepancies);
    }

    return NextResponse.json({
      checked: allCoupons.length,
      fixed,
      discrepancies,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CouponReconciliation] Failed:', error);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
