import { getDb, clients, leads, scheduledMessages } from '@/db';
import { leadContext, escalationQueue } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays, subDays } from 'date-fns';

interface ReviewPayload {
  leadId: string;
  clientId: string;
}

/**
 * Start a review/referral request sequence — marks lead as completed,
 * cancels existing sequences, and schedules review + referral messages.
 * Triggered when a job is finished (contractor marks complete, or Jobber webhook).
 */
export async function startReviewRequest({ leadId, clientId }: ReviewPayload) {
  const db = getDb();

  // 1. Get client and lead
  const clientResult = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

  if (!clientResult.length || !leadResult.length) {
    return { success: false, reason: 'Client or lead not found' };
  }

  const client = clientResult[0];
  const lead = leadResult[0];

  // 2. Sentiment gate — suppress review request for frustrated/negative leads
  // or leads with unresolved escalations (prevents asking unhappy customers for reviews)
  const cutoff14Days = subDays(new Date(), 14);

  const [leadCtx] = await db
    .select({
      currentSentiment: leadContext.currentSentiment,
      updatedAt: leadContext.updatedAt,
    })
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  const hasNegativeSentiment =
    leadCtx !== undefined &&
    (leadCtx.currentSentiment === 'negative' || leadCtx.currentSentiment === 'frustrated') &&
    leadCtx.updatedAt >= cutoff14Days;

  const [unresolvedEscalation] = await db
    .select({ id: escalationQueue.id })
    .from(escalationQueue)
    .where(
      and(
        eq(escalationQueue.leadId, leadId),
        ne(escalationQueue.status, 'resolved'),
        ne(escalationQueue.status, 'dismissed')
      )
    )
    .limit(1);

  if (hasNegativeSentiment || unresolvedEscalation !== undefined) {
    console.log(
      `[ReviewRequest] Review request suppressed — negative sentiment or unresolved escalation (leadId=${leadId}, clientId=${clientId})`
    );
    return {
      success: false,
      reason: 'Review request suppressed — negative sentiment or unresolved escalation',
    };
  }

  // 3. Update lead status to completed (job is done)
  await db
    .update(leads)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  // Track review request funnel event with AI attribution
  try {
    const { trackFunnelEvent } = await import('@/lib/services/funnel-tracking');
    await trackFunnelEvent({
      clientId,
      leadId,
      eventType: 'review_requested',
    });
  } catch {} // Never block review flow on tracking failure

  // 4. Cancel existing review/referral sequences
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'New review sequence started',
    })
    .where(and(
      eq(scheduledMessages.leadId, leadId),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  const scheduledIds: string[] = [];

  // 5. Schedule review request (Day 1, 10am)
  const reviewSendAt = addDays(new Date(), 1);
  reviewSendAt.setHours(10, 0, 0, 0);

  const reviewContent = renderTemplate('review_request', {
    name: lead.name || 'there',
    businessName: client.businessName,
    googleBusinessUrl: client.googleBusinessUrl || 'our Google page',
    projectType: lead.projectType || 'project',
  });

  const reviewScheduled = await db
    .insert(scheduledMessages)
    .values({
      leadId,
      clientId,
      sequenceType: 'review_request',
      sequenceStep: 1,
      content: reviewContent,
      sendAt: reviewSendAt,
    })
    .returning();
  scheduledIds.push(reviewScheduled[0].id);

  // 6. Schedule referral request (Day 4, 10am)
  const referralSendAt = addDays(new Date(), 4);
  referralSendAt.setHours(10, 0, 0, 0);

  const referralContent = renderTemplate('referral_request', {
    name: lead.name || 'there',
    businessName: client.businessName,
  });

  const referralScheduled = await db
    .insert(scheduledMessages)
    .values({
      leadId,
      clientId,
      sequenceType: 'referral_request',
      sequenceStep: 1,
      content: referralContent,
      sendAt: referralSendAt,
    })
    .returning();
  scheduledIds.push(referralScheduled[0].id);

  return {
    success: true,
    scheduledCount: scheduledIds.length,
    scheduledIds,
  };
}
