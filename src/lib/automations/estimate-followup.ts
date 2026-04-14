import { getDb } from '@/db';
import { clients, leads, scheduledMessages, leadContext } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays } from 'date-fns';

interface EstimatePayload {
  leadId: string;
  clientId: string;
}

type ObjectionVariant = 'price_comparison' | 'timeline_concern' | 'partner_approval' | null;

const ESTIMATE_SCHEDULE = [
  { day: 2, baseTemplate: 'estimate_day_2', step: 1 },
  { day: 5, baseTemplate: 'estimate_day_5', step: 2 },
  { day: 10, baseTemplate: 'estimate_day_10', step: 3 },
  { day: 14, baseTemplate: 'estimate_day_14', step: 4 },
];

/**
 * Maps the lead's known objection types to a template variant suffix.
 * First matching objection wins; returns null for the default template.
 */
function detectObjectionVariant(
  objections: Array<{ type: string; detail: string; resolved: boolean }> | null | undefined
): ObjectionVariant {
  if (!objections || objections.length === 0) return null;

  // Only consider unresolved objections
  const active = objections.filter(o => !o.resolved);
  if (active.length === 0) return null;

  for (const objection of active) {
    const type = objection.type.toLowerCase();
    const detail = objection.detail.toLowerCase();

    if (
      type === 'price_comparison' ||
      detail.includes('compet') ||
      detail.includes('other quote') ||
      detail.includes('comparing') ||
      detail.includes('cheaper') ||
      detail.includes('price')
    ) {
      return 'price_comparison';
    }

    if (
      type === 'timeline_concern' ||
      detail.includes('timing') ||
      detail.includes('not ready') ||
      detail.includes('schedule') ||
      detail.includes('busy') ||
      detail.includes('wait')
    ) {
      return 'timeline_concern';
    }

    if (
      type === 'partner_approval' ||
      detail.includes('partner') ||
      detail.includes('spouse') ||
      detail.includes('husband') ||
      detail.includes('wife') ||
      detail.includes('discuss')
    ) {
      return 'partner_approval';
    }
  }

  return null;
}

/**
 * Resolves a template key for a given base template and objection variant.
 * Falls through to the base template when no variant exists.
 */
function resolveEstimateTemplate(baseTemplate: string, variant: ObjectionVariant): string {
  if (!variant) return baseTemplate;
  return `${baseTemplate}_${variant}`;
}

/**
 * Starts an estimate follow-up sequence for a lead.
 * Updates lead status to 'estimate_sent' and schedules follow-up messages at days 2, 5, 10, and 14.
 * @param payload - Lead and client IDs
 * @returns Success status and scheduled message IDs
 */
export async function startEstimateFollowup({ leadId, clientId }: EstimatePayload) {
  console.log('[Payments] Starting estimate follow-up sequence', { leadId, clientId });
  const db = getDb();

  // 1. Get client, lead, and lead context (for objection-based template selection)
  const [clientResult, leadResult, leadContextResult] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, clientId)).limit(1),
    db.select().from(leads).where(eq(leads.id, leadId)).limit(1),
    db.select({ objections: leadContext.objections }).from(leadContext).where(eq(leadContext.leadId, leadId)).limit(1),
  ]);

  if (!clientResult.length || !leadResult.length) {
    return { success: false, reason: 'Client or lead not found' };
  }

  const client = clientResult[0];
  const lead = leadResult[0];

  // Determine objection variant for contextual template selection
  const rawObjections = leadContextResult[0]?.objections as Array<{ type: string; detail: string; resolved: boolean }> | null | undefined;
  const objectionVariant = detectObjectionVariant(rawObjections);

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

    const templateKey = resolveEstimateTemplate(item.baseTemplate, objectionVariant);
    const content = renderTemplate(templateKey, {
      name: lead.name || 'there',
      ownerName: client.ownerName,
      businessName: client.businessName,
      businessPhone: client.phone,
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
