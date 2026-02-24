import { getDb } from '@/db';
import { billingEvents, subscriptions } from '@/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  buildGuaranteeBackfillState,
  type GuaranteeStatusValue,
} from '@/lib/services/guarantee-v2/state-machine';
import { countQualifiedLeadEngagements } from '@/lib/services/guarantee-v2/metrics';
import { evaluateProofWindowStatus } from '@/lib/services/guarantee-v2/proof-evaluator';

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
  proofPassed: number;
  proofFailedRefundReview: number;
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
    proofPassed: 0,
    proofFailedRefundReview: 0,
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

    const proofWindowStart = backfill.proofStartAt;
    const proofWindowEnd = backfill.adjustedProofEndsAt;
    const qleMetrics = await countQualifiedLeadEngagements(
      sub.clientId,
      proofWindowStart,
      proofWindowEnd
    );

    const action = evaluateProofWindowStatus({
      status: backfill.guaranteeStatus,
      qualifiedLeadEngagements: qleMetrics.count,
      now,
      proofWindowEnd,
    });

    if (action === 'proof_pass') {
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            guaranteeStatus: 'proof_passed',
            guaranteeProofQualifiedLeadEngagements: qleMetrics.count,
            guaranteeFulfilledAt: now,
            guaranteeNotes: `Proof-of-life passed with ${qleMetrics.count} qualified lead engagements.`,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await tx.insert(billingEvents).values({
          clientId: sub.clientId,
          subscriptionId: sub.id,
          eventType: 'guarantee_proof_passed',
          description: `Proof-of-life passed (${qleMetrics.count} qualified lead engagements).`,
          rawData: {
            qualifiedLeadEngagements: qleMetrics.count,
            qualifiedLeadIds: qleMetrics.qualifiedLeadIds,
            proofWindowStart: proofWindowStart.toISOString(),
            proofWindowEnd: proofWindowEnd.toISOString(),
          },
        });
      });
      result.proofPassed++;
      continue;
    }

    if (action === 'proof_fail_refund_review') {
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            guaranteeStatus: 'proof_failed_refund_review',
            guaranteeProofQualifiedLeadEngagements: qleMetrics.count,
            guaranteeRefundEligibleAt: now,
            guaranteeNotes:
              `Proof-of-life missed: ${qleMetrics.count} qualified lead engagements in proof window.`,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await tx.insert(billingEvents).values({
          clientId: sub.clientId,
          subscriptionId: sub.id,
          eventType: 'guarantee_proof_refund_review_required',
          description: `Proof-of-life missed (${qleMetrics.count} qualified lead engagements). Refund review required.`,
          rawData: {
            qualifiedLeadEngagements: qleMetrics.count,
            qualifiedLeadIds: qleMetrics.qualifiedLeadIds,
            proofWindowStart: proofWindowStart.toISOString(),
            proofWindowEnd: proofWindowEnd.toISOString(),
          },
        });
      });

      result.proofFailedRefundReview++;
      continue;
    }

    if (backfill.guaranteeStatus === 'proof_pending') {
      await db
        .update(subscriptions)
        .set({
          guaranteeProofQualifiedLeadEngagements: qleMetrics.count,
          guaranteeNotes: `Proof-of-life in progress: ${qleMetrics.count} qualified lead engagements so far.`,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
    }
  }

  return result;
}
