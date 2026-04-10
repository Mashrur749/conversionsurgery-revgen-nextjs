import { getDb } from '@/db';
import { cancellationRequests, clients, dailyStats, leads, jobs, subscriptions, plans } from '@/db/schema';
import { eq, and, sql, inArray, desc, lt } from 'drizzle-orm';
import { buildGuaranteeSummary } from '@/lib/services/guarantee-v2/summary';
import { calculateEffectiveCancellationDate } from '@/lib/services/cancellation-policy';

export interface ValueSummary {
  monthsActive: number;
  totalLeads: number;
  totalMessages: number;
  estimatedRevenue: number;
  confirmedRevenue: number;
  stuckEstimates: number;
  monthlyCost: number;
  roi: number;
}

export interface GuaranteeCancellationContext {
  status: string;
  statusLabel: string;
  refundReviewRequired: boolean;
  refundEligibleAt: string | null;
}

export interface CancellationConfirmationResult {
  requestId: string;
  clientId: string;
  effectiveCancellationDate: Date;
  processedAt: Date;
}

export async function getGuaranteeCancellationContext(
  clientId: string
): Promise<GuaranteeCancellationContext | null> {
  const db = getDb();
  const [subscription] = await db
    .select({
      guaranteeStatus: subscriptions.guaranteeStatus,
      guaranteeProofStartAt: subscriptions.guaranteeProofStartAt,
      guaranteeProofEndsAt: subscriptions.guaranteeProofEndsAt,
      guaranteeRecoveryStartAt: subscriptions.guaranteeRecoveryStartAt,
      guaranteeRecoveryEndsAt: subscriptions.guaranteeRecoveryEndsAt,
      guaranteeAdjustedProofEndsAt: subscriptions.guaranteeAdjustedProofEndsAt,
      guaranteeAdjustedRecoveryEndsAt: subscriptions.guaranteeAdjustedRecoveryEndsAt,
      guaranteeObservedMonthlyLeadAverage: subscriptions.guaranteeObservedMonthlyLeadAverage,
      guaranteeExtensionFactorBasisPoints: subscriptions.guaranteeExtensionFactorBasisPoints,
      guaranteeProofQualifiedLeadEngagements: subscriptions.guaranteeProofQualifiedLeadEngagements,
      guaranteeRecoveryAttributedOpportunities: subscriptions.guaranteeRecoveryAttributedOpportunities,
      guaranteeRefundEligibleAt: subscriptions.guaranteeRefundEligibleAt,
      guaranteeNotes: subscriptions.guaranteeNotes,
    })
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  if (!subscription) {
    return null;
  }

  const guarantee = buildGuaranteeSummary({
    guaranteeStatus: subscription.guaranteeStatus,
    guaranteeProofStartAt: subscription.guaranteeProofStartAt,
    guaranteeProofEndsAt: subscription.guaranteeProofEndsAt,
    guaranteeRecoveryStartAt: subscription.guaranteeRecoveryStartAt,
    guaranteeRecoveryEndsAt: subscription.guaranteeRecoveryEndsAt,
    guaranteeAdjustedProofEndsAt: subscription.guaranteeAdjustedProofEndsAt,
    guaranteeAdjustedRecoveryEndsAt: subscription.guaranteeAdjustedRecoveryEndsAt,
    guaranteeObservedMonthlyLeadAverage: subscription.guaranteeObservedMonthlyLeadAverage,
    guaranteeExtensionFactorBasisPoints: subscription.guaranteeExtensionFactorBasisPoints,
    guaranteeProofQualifiedLeadEngagements: subscription.guaranteeProofQualifiedLeadEngagements,
    guaranteeRecoveryAttributedOpportunities: subscription.guaranteeRecoveryAttributedOpportunities,
    guaranteeRefundEligibleAt: subscription.guaranteeRefundEligibleAt,
    guaranteeNotes: subscription.guaranteeNotes,
  });

  return {
    status: guarantee.status,
    statusLabel: guarantee.statusLabel,
    refundReviewRequired: guarantee.refundReviewRequired,
    refundEligibleAt: guarantee.refundEligibleAt,
  };
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

  // Calculate conversion rate from actual lead data
  const [leadCounts] = await db
    .select({
      totalLeads: sql<number>`COUNT(*)`,
      wonLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'won')`,
    })
    .from(leads)
    .where(eq(leads.clientId, clientId));

  const actualTotalLeads = Number(leadCounts?.totalLeads || 0);
  const wonLeads = Number(leadCounts?.wonLeads || 0);
  const conversionRate = actualTotalLeads > 0 ? wonLeads / actualTotalLeads : 0.1;

  // Get average job value from won jobs (amounts in cents), fall back to $3000
  const [avgJob] = await db
    .select({
      avgValue: sql<number>`COALESCE(AVG(${jobs.finalAmount}), 300000)`,
    })
    .from(jobs)
    .where(and(
      eq(jobs.clientId, clientId),
      eq(jobs.status, 'won'),
    ));

  // avgValue is in cents, convert to dollars
  const avgJobValue = Number(avgJob?.avgValue || 300000) / 100;

  // Get actual monthly cost from active subscription/plan (priceMonthly is in cents)
  let monthlyCost = 997; // fallback in dollars
  const [activeSub] = await db
    .select({ plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(
      eq(subscriptions.clientId, clientId),
      inArray(subscriptions.status, ['active', 'trialing'])
    ))
    .limit(1);

  if (activeSub?.plan) {
    monthlyCost = (activeSub.plan.priceMonthly ?? 99700) / 100;
  }

  // Confirmed revenue: sum of confirmedRevenue on won leads (stored in cents)
  const wonLeadsRevenue = await db
    .select({ revenue: leads.confirmedRevenue })
    .from(leads)
    .where(and(eq(leads.clientId, clientId), eq(leads.status, 'won')));
  const confirmedRevenueCents = wonLeadsRevenue.reduce(
    (sum: number, l: { revenue: number | null }) => sum + (l.revenue ?? 0),
    0
  );
  const confirmedRevenue = Math.round(confirmedRevenueCents / 100);

  // Stuck estimates: leads in estimate_sent for > 14 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [stuckRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'estimate_sent'),
        lt(leads.updatedAt, fourteenDaysAgo)
      )
    );
  const stuckEstimates = Number(stuckRow?.count ?? 0);

  const estimatedRevenue = Math.round(totalLeads * conversionRate * avgJobValue);
  const totalCost = monthsActive * monthlyCost;
  const roi = totalCost > 0 ? Math.round((estimatedRevenue / totalCost) * 100) : 0;

  return {
    monthsActive,
    totalLeads,
    totalMessages,
    estimatedRevenue,
    confirmedRevenue,
    stuckEstimates,
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
  const guaranteeContext = await getGuaranteeCancellationContext(clientId);

  const [client] = await db
    .select({ businessName: clients.businessName, twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const [request] = await db
    .insert(cancellationRequests)
    .values({
      clientId,
      reason,
      feedback,
      valueShown: {
        ...valueSummary,
        guaranteeContext,
      },
    })
    .returning();

  // Alert operator immediately (non-fatal)
  try {
    const { getAgencyField } = await import('@/lib/services/agency-settings');
    const { sendSMS } = await import('@/lib/services/twilio');
    const operatorPhone = await getAgencyField('operatorPhone');
    const agencyTwilioNumber = await getAgencyField('twilioNumber');
    if (operatorPhone && agencyTwilioNumber) {
      const businessName = client?.businessName ?? clientId;
      const reasonText = reason || 'Not specified';
      await sendSMS(
        operatorPhone,
        `URGENT: Cancellation request from ${businessName}. Reason: ${reasonText}. Schedule retention call.`,
        agencyTwilioNumber
      );
    }
  } catch {
    // Non-fatal — cancellation record already saved
  }

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
 * Confirm cancellation with 30-day notice terms.
 */
export async function confirmCancellation(
  requestId: string
): Promise<CancellationConfirmationResult> {
  const db = getDb();

  // Get the cancellation request to find the clientId
  const [request] = await db
    .select()
    .from(cancellationRequests)
    .where(eq(cancellationRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error('Cancellation request not found');
  const processedAt = new Date();
  const effectiveCancellationDate = calculateEffectiveCancellationDate(processedAt);

  await db
    .update(cancellationRequests)
    .set({
      status: 'cancelled',
      gracePeriodEnds: effectiveCancellationDate,
      processedAt,
    })
    .where(eq(cancellationRequests.id, requestId));

  // B5: Cancel Stripe subscription at end of billing period
  const [activeSub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.clientId, request.clientId),
      inArray(subscriptions.status, ['active', 'trialing'])
    ))
    .limit(1);

  if (activeSub) {
    const { cancelSubscription } = await import('@/lib/services/subscription');
    await cancelSubscription(
      activeSub.id,
      request.reason || 'Client initiated cancellation',
      false // cancel at period end, not immediately
    );
  }

  return {
    requestId,
    clientId: request.clientId,
    effectiveCancellationDate,
    processedAt,
  };
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

export async function getLatestCancelledCancellation(clientId: string) {
  const db = getDb();

  const [request] = await db
    .select({
      id: cancellationRequests.id,
      reason: cancellationRequests.reason,
      feedback: cancellationRequests.feedback,
      processedAt: cancellationRequests.processedAt,
      effectiveCancellationDate: cancellationRequests.gracePeriodEnds,
    })
    .from(cancellationRequests)
    .where(and(
      eq(cancellationRequests.clientId, clientId),
      eq(cancellationRequests.status, 'cancelled')
    ))
    .orderBy(desc(cancellationRequests.processedAt), desc(cancellationRequests.createdAt))
    .limit(1);

  return request || null;
}
