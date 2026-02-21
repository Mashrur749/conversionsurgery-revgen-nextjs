import { getDb } from '@/db';
import { billingEvents, leads, subscriptions } from '@/db/schema';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

const GUARANTEE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RECOVERED_STATUSES = ['contacted', 'estimate_sent', 'won'] as const;
const RECOVERED_SOURCES = ['missed_call', 'form'] as const;

interface GuaranteeRunResult {
  checked: number;
  fulfilled: number;
  refundReviewRequired: number;
  initialized: number;
}

/**
 * Daily guarantee evaluator:
 * - Initializes guarantee window for legacy subscriptions without guarantee fields.
 * - Marks fulfilled when at least one recovered lead is detected during window.
 * - Flags refund review when window expires with no recovered lead.
 */
export async function processGuaranteeStatus(): Promise<GuaranteeRunResult> {
  const db = getDb();
  const now = new Date();
  const result: GuaranteeRunResult = {
    checked: 0,
    fulfilled: 0,
    refundReviewRequired: 0,
    initialized: 0,
  };

  const candidates = await db
    .select({
      id: subscriptions.id,
      clientId: subscriptions.clientId,
      createdAt: subscriptions.createdAt,
      guaranteeStartAt: subscriptions.guaranteeStartAt,
      guaranteeEndsAt: subscriptions.guaranteeEndsAt,
      guaranteeStatus: subscriptions.guaranteeStatus,
    })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ['trialing', 'active', 'past_due']),
        or(
          eq(subscriptions.guaranteeStatus, 'pending'),
          eq(subscriptions.guaranteeStatus, 'refund_review_required'),
          eq(subscriptions.guaranteeStatus, 'fulfilled'),
          isNull(subscriptions.guaranteeStatus)
        )
      )
    );

  result.checked = candidates.length;

  for (const sub of candidates) {
    const guaranteeStartAt = sub.guaranteeStartAt ?? sub.createdAt;
    const guaranteeEndsAt = sub.guaranteeEndsAt ?? new Date(guaranteeStartAt.getTime() + GUARANTEE_WINDOW_MS);

    if (!sub.guaranteeStartAt || !sub.guaranteeEndsAt) {
      await db
        .update(subscriptions)
        .set({
          guaranteeStartAt,
          guaranteeEndsAt,
          guaranteeStatus: sub.guaranteeStatus || 'pending',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));
      result.initialized++;
    }

    const [recoveredLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, sub.clientId),
          inArray(leads.status, [...RECOVERED_STATUSES]),
          inArray(leads.source, [...RECOVERED_SOURCES]),
          gte(leads.createdAt, guaranteeStartAt),
          lte(leads.createdAt, guaranteeEndsAt)
        )
      )
      .limit(1);

    if (recoveredLead) {
      if (sub.guaranteeStatus !== 'fulfilled') {
        await db.transaction(async (tx) => {
          await tx
            .update(subscriptions)
            .set({
              guaranteeStatus: 'fulfilled',
              guaranteeFulfilledAt: now,
              guaranteeRecoveredLeadId: recoveredLead.id,
              guaranteeNotes: 'Recovered lead detected within guarantee window.',
              updatedAt: now,
            })
            .where(eq(subscriptions.id, sub.id));

          await tx.insert(billingEvents).values({
            clientId: sub.clientId,
            subscriptionId: sub.id,
            eventType: 'guarantee_fulfilled',
            description: '30-day guarantee fulfilled by recovered lead.',
          });
        });
        result.fulfilled++;
      }
      continue;
    }

    if (now > guaranteeEndsAt && sub.guaranteeStatus === 'pending') {
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            guaranteeStatus: 'refund_review_required',
            guaranteeRefundEligibleAt: now,
            guaranteeNotes:
              'No recovered lead detected in first 30 days. Refund review required.',
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await tx.insert(billingEvents).values({
          clientId: sub.clientId,
          subscriptionId: sub.id,
          eventType: 'guarantee_refund_review_required',
          description: '30-day guarantee missed. Subscription flagged for refund review.',
        });
      });

      result.refundReviewRequired++;
    }
  }

  return result;
}
