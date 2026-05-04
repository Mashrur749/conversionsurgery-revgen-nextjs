import { getDb } from '@/db';
import { plans, subscriptions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Check whether the Pilot tier is available (max 3 active subscriptions).
 */
export async function isPilotTierAvailable(): Promise<{
  available: boolean;
  activeCount: number;
  maxAllowed: number;
}> {
  const db = getDb();

  // Get the Pilot plan's cap
  const [pilotPlan] = await db
    .select({ id: plans.id, maxActiveClients: plans.maxActiveClients })
    .from(plans)
    .where(eq(plans.slug, 'pilot'))
    .limit(1);

  if (!pilotPlan) {
    return { available: false, activeCount: 0, maxAllowed: 0 };
  }

  const maxAllowed = pilotPlan.maxActiveClients ?? Infinity;

  // Count active subscriptions on the Pilot plan
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planId, pilotPlan.id),
        sql`${subscriptions.status} IN ('active', 'trialing')`
      )
    );

  const activeCount = result?.count ?? 0;

  return {
    available: activeCount < maxAllowed,
    activeCount,
    maxAllowed: maxAllowed === Infinity ? 0 : maxAllowed,
  };
}

/**
 * Check whether a specific plan can accept new subscriptions.
 * Generic version — works for any plan with maxActiveClients set.
 */
export async function isPlanAvailable(planId: string): Promise<{
  available: boolean;
  activeCount: number;
  maxAllowed: number | null;
}> {
  const db = getDb();

  const [plan] = await db
    .select({ maxActiveClients: plans.maxActiveClients })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) throw new Error('Plan not found');

  // No cap = always available
  if (plan.maxActiveClients === null) {
    return { available: true, activeCount: 0, maxAllowed: null };
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planId, planId),
        sql`${subscriptions.status} IN ('active', 'trialing')`
      )
    );

  const activeCount = result?.count ?? 0;

  return {
    available: activeCount < plan.maxActiveClients,
    activeCount,
    maxAllowed: plan.maxActiveClients,
  };
}
