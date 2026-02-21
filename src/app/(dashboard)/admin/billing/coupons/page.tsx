import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { coupons } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { CouponManager } from './coupon-manager';

export default async function CouponsPage() {
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const db = getDb();
  const allCoupons = await db.select().from(coupons).orderBy(desc(coupons.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coupons</h1>
        <p className="text-muted-foreground">
          Create and manage discount codes for subscriptions.
        </p>
      </div>
      <CouponManager coupons={allCoupons} />
    </div>
  );
}
