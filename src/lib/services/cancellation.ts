import { getDb } from '@/db';
import { cancellationRequests, clients, dailyStats } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface ValueSummary {
  monthsActive: number;
  totalLeads: number;
  totalMessages: number;
  estimatedRevenue: number;
  monthlyCost: number;
  roi: number;
}

/**
 * Get value summary for client showing ROI and usage stats
 */
export async function getValueSummary(clientId: string): Promise<ValueSummary> {
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) throw new Error('Client not found');

  const createdAt = new Date(client.createdAt!);
  const now = new Date();
  const monthsActive = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));

  // Get all-time stats
  const [stats] = await db
    .select({
      totalLeads: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      totalMessages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(eq(dailyStats.clientId, clientId));

  const totalLeads = Number(stats?.totalLeads || 0);
  const totalMessages = Number(stats?.totalMessages || 0);

  // Estimate: 10% of leads convert, average job value $3000
  const estimatedRevenue = Math.round(totalLeads * 0.1 * 3000);
  const monthlyCost = 997;
  const totalCost = monthsActive * monthlyCost;
  const roi = totalCost > 0 ? Math.round((estimatedRevenue / totalCost) * 100) : 0;

  return {
    monthsActive,
    totalLeads,
    totalMessages,
    estimatedRevenue,
    monthlyCost,
    roi,
  };
}

/**
 * Initiate cancellation request with value summary
 */
export async function initiateCancellation(
  clientId: string,
  reason: string,
  feedback?: string
): Promise<string> {
  const db = getDb();
  const valueSummary = await getValueSummary(clientId);

  const [request] = await db
    .insert(cancellationRequests)
    .values({
      clientId,
      reason,
      feedback,
      valueShown: valueSummary,
    })
    .returning();

  return request.id;
}

/**
 * Schedule retention call for cancellation request
 */
export async function scheduleRetentionCall(
  requestId: string,
  scheduledAt: Date
): Promise<void> {
  const db = getDb();

  await db
    .update(cancellationRequests)
    .set({
      status: 'scheduled_call',
      scheduledCallAt: scheduledAt,
    })
    .where(eq(cancellationRequests.id, requestId));
}

/**
 * Mark cancellation request as saved (client retained)
 */
export async function markAsSaved(requestId: string): Promise<void> {
  const db = getDb();

  await db
    .update(cancellationRequests)
    .set({
      status: 'saved',
      processedAt: new Date(),
    })
    .where(eq(cancellationRequests.id, requestId));
}

/**
 * Confirm cancellation with grace period
 */
export async function confirmCancellation(
  requestId: string,
  gracePeriodDays: number = 7
): Promise<void> {
  const db = getDb();
  const gracePeriodEnds = new Date();
  gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);

  await db
    .update(cancellationRequests)
    .set({
      status: 'cancelled',
      gracePeriodEnds,
      processedAt: new Date(),
    })
    .where(eq(cancellationRequests.id, requestId));
}

/**
 * Get pending cancellation request for client
 */
export async function getPendingCancellation(clientId: string) {
  const db = getDb();

  const [request] = await db
    .select()
    .from(cancellationRequests)
    .where(and(
      eq(cancellationRequests.clientId, clientId),
      eq(cancellationRequests.status, 'pending')
    ))
    .limit(1);

  return request;
}
