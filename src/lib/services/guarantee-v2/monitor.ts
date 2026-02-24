import { getDb } from '@/db';
import { billingEvents, leads, subscriptions } from '@/db/schema';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import {
  buildGuaranteeBackfillState,
  toLegacyGuaranteeStatus,
  type GuaranteeStatusValue,
} from '@/lib/services/guarantee-v2/state-machine';

const RECOVERED_STATUSES = ['contacted', 'estimate_sent', 'won'] as const;
const RECOVERED_SOURCES = ['missed_call', 'form'] as const;

const GUARANTEE_ELIGIBLE_STATUSES = [
  'pending',
  'fulfilled',
  'refund_review_required',
  'proof_pending',
  'proof_passed',
  'proof_failed_refund_review',
  'recovery_pending',
  'recovery_passed',
  'recovery_failed_refund_review',
] as const;

export interface GuaranteeRunResult {
  checked: number;
  fulfilled: number;
  refundReviewRequired: number;
  initialized: number;
}

/**
 * Transitional guarantee evaluator during v2 rollout.
 * Milestone A responsibilities:
 * - Backfill guarantee v2 windows + status mapping safely.
 * - Keep legacy recovered-lead behavior operational until v2 evaluators ship.
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
      guaranteeProofStartAt: subscriptions.guaranteeProofStartAt,
      guaranteeProofEndsAt: subscriptions.guaranteeProofEndsAt,
      guaranteeRecoveryStartAt: subscriptions.guaranteeRecoveryStartAt,
      guaranteeRecoveryEndsAt: subscriptions.guaranteeRecoveryEndsAt,
      guaranteeAdjustedProofEndsAt: subscriptions.guaranteeAdjustedProofEndsAt,
      guaranteeAdjustedRecoveryEndsAt: subscriptions.guaranteeAdjustedRecoveryEndsAt,
      guaranteeExtensionFactorBasisPoints: subscriptions.guaranteeExtensionFactorBasisPoints,
    })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ['trialing', 'active', 'past_due']),
        or(
          inArray(subscriptions.guaranteeStatus, [...GUARANTEE_ELIGIBLE_STATUSES]),
          isNull(subscriptions.guaranteeStatus)
        )
      )
    );

  result.checked = candidates.length;

  for (const sub of candidates) {
    const backfill = buildGuaranteeBackfillState({
      createdAt: sub.createdAt,
      guaranteeStartAt: sub.guaranteeStartAt,
      guaranteeEndsAt: sub.guaranteeEndsAt,
      guaranteeStatus: sub.guaranteeStatus as GuaranteeStatusValue,
    });

    const needsBackfill =
      !sub.guaranteeProofStartAt ||
      !sub.guaranteeProofEndsAt ||
      !sub.guaranteeRecoveryStartAt ||
      !sub.guaranteeRecoveryEndsAt ||
      !sub.guaranteeAdjustedProofEndsAt ||
      !sub.guaranteeAdjustedRecoveryEndsAt ||
      !sub.guaranteeExtensionFactorBasisPoints ||
      sub.guaranteeStatus !== backfill.guaranteeStatus;

    if (needsBackfill) {
      await db
        .update(subscriptions)
        .set({
          guaranteeStatus: backfill.guaranteeStatus,
          guaranteeStartAt: backfill.proofStartAt,
          guaranteeEndsAt: backfill.proofEndsAt,
          guaranteeProofStartAt: backfill.proofStartAt,
          guaranteeProofEndsAt: backfill.proofEndsAt,
          guaranteeRecoveryStartAt: backfill.recoveryStartAt,
          guaranteeRecoveryEndsAt: backfill.recoveryEndsAt,
          guaranteeAdjustedProofEndsAt: backfill.adjustedProofEndsAt,
          guaranteeAdjustedRecoveryEndsAt: backfill.adjustedRecoveryEndsAt,
          guaranteeExtensionFactorBasisPoints: backfill.extensionFactorBasisPoints,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
      result.initialized++;
    }

    // Legacy-compatible evaluation path until v2 proof/recovery evaluators are shipped.
    const legacyStatus = toLegacyGuaranteeStatus(backfill.guaranteeStatus);
    const proofWindowStart = backfill.proofStartAt;
    const proofWindowEnd = backfill.proofEndsAt;

    const [recoveredLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, sub.clientId),
          inArray(leads.status, [...RECOVERED_STATUSES]),
          inArray(leads.source, [...RECOVERED_SOURCES]),
          gte(leads.createdAt, proofWindowStart),
          lte(leads.createdAt, proofWindowEnd)
        )
      )
      .limit(1);

    if (recoveredLead) {
      if (legacyStatus !== 'fulfilled') {
        await db.transaction(async (tx) => {
          await tx
            .update(subscriptions)
            .set({
              guaranteeStatus: 'proof_passed',
              guaranteeFulfilledAt: now,
              guaranteeRecoveredLeadId: recoveredLead.id,
              guaranteeNotes: 'Recovered lead detected within proof window.',
              updatedAt: now,
            })
            .where(eq(subscriptions.id, sub.id));

          await tx.insert(billingEvents).values({
            clientId: sub.clientId,
            subscriptionId: sub.id,
            eventType: 'guarantee_fulfilled',
            description: 'Proof window fulfilled by recovered lead.',
          });
        });
        result.fulfilled++;
      }
      continue;
    }

    if (now > proofWindowEnd && legacyStatus === 'pending') {
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            guaranteeStatus: 'proof_failed_refund_review',
            guaranteeRefundEligibleAt: now,
            guaranteeNotes:
              'No recovered lead detected in proof window. Refund review required.',
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await tx.insert(billingEvents).values({
          clientId: sub.clientId,
          subscriptionId: sub.id,
          eventType: 'guarantee_refund_review_required',
          description: 'Proof window missed. Subscription flagged for refund review.',
        });
      });

      result.refundReviewRequired++;
    }
  }

  return result;
}

