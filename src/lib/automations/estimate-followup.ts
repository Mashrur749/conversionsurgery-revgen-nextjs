import { getDb, clients, leads, scheduledMessages } from '@/db';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays } from 'date-fns';

interface EstimatePayload {
  leadId: string;
  clientId: string;
}

const ESTIMATE_SCHEDULE = [
  { day: 2, template: 'estimate_day_2', step: 1 },
  { day: 5, template: 'estimate_day_5', step: 2 },
  { day: 10, template: 'estimate_day_10', step: 3 },
  { day: 14, template: 'estimate_day_14', step: 4 },
];

export async function startEstimateFollowup({ leadId, clientId }: EstimatePayload) {
  const db = getDb();

  // 1. Get client and lead
  const clientResult = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

  if (!clientResult.length || !leadResult.length) {
    return { success: false, reason: 'Client or lead not found' };
  }

  const client = clientResult[0];
  const lead = leadResult[0];

  // 2. Update lead status
  await db
    .update(leads)
    .set({ status: 'estimate_sent', updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  // 3. Cancel existing estimate sequences
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'New estimate sequence started',
    })
    .where(and(
      eq(scheduledMessages.leadId, leadId),
      eq(scheduledMessages.sequenceType, 'estimate_followup'),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // 4. Schedule all follow-ups
  const now = new Date();
  const scheduledIds: string[] = [];

  for (const item of ESTIMATE_SCHEDULE) {
    const sendAt = addDays(now, item.day);
    sendAt.setHours(10, 0, 0, 0); // 10am

    const content = renderTemplate(item.template, {
      name: lead.name || 'there',
      ownerName: client.ownerName,
      businessName: client.businessName,
    });

    const scheduled = await db
      .insert(scheduledMessages)
      .values({
        leadId,
        clientId,
        sequenceType: 'estimate_followup',
        sequenceStep: item.step,
        content,
        sendAt,
      })
      .returning();

    scheduledIds.push(scheduled[0].id);
  }

  return {
    success: true,
    scheduledCount: scheduledIds.length,
    scheduledIds,
  };
}
