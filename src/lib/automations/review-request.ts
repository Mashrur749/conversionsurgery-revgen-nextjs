import { getDb, clients, leads, scheduledMessages } from '@/db';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays } from 'date-fns';

interface ReviewPayload {
  leadId: string;
  clientId: string;
}

/**
 * Start a review/referral request sequence — marks lead as won,
 * cancels existing sequences, and schedules review + referral messages
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

  // 2. Update lead status to won
  await db
    .update(leads)
    .set({ status: 'won', updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  // 3. Cancel existing review/referral sequences
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

  // 4. Schedule review request (Day 1, 10am)
  const reviewSendAt = addDays(new Date(), 1);
  reviewSendAt.setHours(10, 0, 0, 0);

  const reviewContent = renderTemplate('review_request', {
    name: lead.name || 'there',
    businessName: client.businessName,
    googleBusinessUrl: client.googleBusinessUrl || 'our Google page',
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

  // 5. Schedule referral request (Day 4, 10am)
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
