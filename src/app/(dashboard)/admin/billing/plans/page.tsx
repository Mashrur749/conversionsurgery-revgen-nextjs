import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { plans } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { PlanList } from './plan-list';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const db = getDb();
  const allPlans = await db
    .select()
    .from(plans)
    .orderBy(asc(plans.displayOrder));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Manage pricing and feature configuration</p>
        </div>
      </div>
      <PlanList plans={allPlans} />
    </div>
  );
}
