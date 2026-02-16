import { getDb } from '@/db';
import { clients, clientCohorts, subscriptions, leads } from '@/db/schema';
import { eq, and, gte, count, sql } from 'drizzle-orm';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Update cohort retention metrics for all clients.
 * Should run monthly (first of each month).
 */
export async function updateCohortMetrics(): Promise<{ processed: number }> {
  const db = getDb();
  const now = new Date();
  let processed = 0;

  // Get all clients with their signup date
  const allClients = await db
    .select({
      id: clients.id,
      createdAt: clients.createdAt,
      status: clients.status,
    })
    .from(clients)
    .where(eq(clients.isTest, false));

  for (const client of allClients) {
    const cohortMonth = format(client.createdAt, 'yyyy-MM');
    const monthsSinceSignup = Math.floor(
      (now.getTime() - client.createdAt.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
    );

    // Check activity: has leads created in the last 30 days
    const isActive = client.status === 'active';

    // Check activity for specific month milestones
    const checkActivityAtMonth = async (monthsAgo: number): Promise<boolean> => {
      if (monthsSinceSignup < monthsAgo) return false;
      const targetDate = subMonths(now, monthsSinceSignup - monthsAgo);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const [result] = await db
        .select({ count: count() })
        .from(leads)
        .where(and(
          eq(leads.clientId, client.id),
          gte(leads.createdAt, monthStart),
        ));

      return (result?.count ?? 0) > 0;
    };

    // Get subscription revenue
    const [subData] = await db
      .select({
        totalPaid: sql<number>`coalesce(sum(${subscriptions.currentPeriodEnd}::date - ${subscriptions.currentPeriodStart}::date), 0)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.clientId, client.id));

    const updates = {
      clientId: client.id,
      cohortMonth,
      month1Active: monthsSinceSignup >= 1 ? await checkActivityAtMonth(1) : null,
      month2Active: monthsSinceSignup >= 2 ? await checkActivityAtMonth(2) : null,
      month3Active: monthsSinceSignup >= 3 ? await checkActivityAtMonth(3) : null,
      month6Active: monthsSinceSignup >= 6 ? await checkActivityAtMonth(6) : null,
      month12Active: monthsSinceSignup >= 12 ? await checkActivityAtMonth(12) : null,
    };

    // Upsert cohort record
    await db
      .insert(clientCohorts)
      .values(updates)
      .onConflictDoUpdate({
        target: clientCohorts.clientId,
        set: {
          cohortMonth: updates.cohortMonth,
          month1Active: updates.month1Active,
          month2Active: updates.month2Active,
          month3Active: updates.month3Active,
          month6Active: updates.month6Active,
          month12Active: updates.month12Active,
        },
      });

    processed++;
  }

  return { processed };
}
