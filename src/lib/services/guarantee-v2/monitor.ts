import { getDb, withTransaction } from '@/db';
import { billingEvents, subscriptions } from '@/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  buildGuaranteeBackfillState,
  type GuaranteeV2Status,
  type GuaranteeStatusValue,
} from '@/lib/services/guarantee-v2/state-machine';
import {
  countQualifiedLeadEngagements,
  countRecoveryAttributedOpportunities,
  calculateObservedMonthlyLeadAverage,
  type AttributedOpportunity,
  type RecoveryAttributedOpportunityMetrics,
} from '@/lib/services/guarantee-v2/metrics';
import { applyLowVolumeExtensionFormula } from '@/lib/services/guarantee-v2/extension-formula';
import { evaluateProofWindowStatus } from '@/lib/services/guarantee-v2/proof-evaluator';
import { evaluateRecoveryWindowStatus } from '@/lib/services/guarantee-v2/recovery-evaluator';
import { calculateProbablePipelineValueCents } from '@/lib/services/pipeline-value';

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
  recoveryPendingStarted: number;
  recoveryPassed: number;
  recoveryFailedRefundReview: number;
  extensionUpdated: number;
  initialized: number;
}

interface GuaranteeCandidate {
  id: string;
  clientId: string;
  createdAt: Date;
  guaranteeStartAt: Date | null;
  guaranteeEndsAt: Date | null;
  guaranteeStatus: string | null;
  guaranteeProofStartAt: Date | null;
  guaranteeProofEndsAt: Date | null;
  guaranteeRecoveryStartAt: Date | null;
  guaranteeRecoveryEndsAt: Date | null;
  guaranteeAdjustedProofEndsAt: Date | null;
  guaranteeAdjustedRecoveryEndsAt: Date | null;
  guaranteeObservedMonthlyLeadAverage: number | null;
  guaranteeExtensionFactorBasisPoints: number | null;
  guaranteeNotes: string | null;
}

interface GuaranteeWindowContext {
  proofWindowStart: Date;
  proofWindowEnd: Date;
  recoveryWindowStart: Date;
  recoveryWindowEnd: Date;
}

async function applyLowVolumeExtensionAndSync(
  sub: GuaranteeCandidate,
  backfill: ReturnType<typeof buildGuaranteeBackfillState>,
  now: Date
): Promise<{
  windowContext: GuaranteeWindowContext;
  extensionUpdated: boolean;
}> {
  const db = getDb();

  const proofStartAt = sub.guaranteeProofStartAt ?? backfill.proofStartAt;
  const proofEndsAt = sub.guaranteeProofEndsAt ?? backfill.proofEndsAt;
  const recoveryStartAt = sub.guaranteeRecoveryStartAt ?? backfill.recoveryStartAt;
  const recoveryEndsAt = sub.guaranteeRecoveryEndsAt ?? backfill.recoveryEndsAt;

  const currentAdjustedProofEndsAt =
    sub.guaranteeAdjustedProofEndsAt ?? backfill.adjustedProofEndsAt;
  const currentAdjustedRecoveryEndsAt =
    sub.guaranteeAdjustedRecoveryEndsAt ?? backfill.adjustedRecoveryEndsAt;
  const currentExtensionFactorBasisPoints =
    sub.guaranteeExtensionFactorBasisPoints ?? backfill.extensionFactorBasisPoints;

  const observedPeriodEnd =
    now < currentAdjustedRecoveryEndsAt ? now : currentAdjustedRecoveryEndsAt;
  const { observedMonthlyLeadAverage, leadCount } =
    await calculateObservedMonthlyLeadAverage(
      sub.clientId,
      proofStartAt,
      observedPeriodEnd
    );

  const extensionComputation = applyLowVolumeExtensionFormula({
    observedMonthlyLeadAverage,
    currentExtensionFactorBasisPoints,
    proofStartAt,
    proofEndsAt,
    recoveryStartAt,
    recoveryEndsAt,
  });

  const extensionFactorIncreased =
    extensionComputation.extensionFactorBasisPoints >
    currentExtensionFactorBasisPoints;

  const extensionChanged =
    extensionComputation.extensionFactorBasisPoints !==
      currentExtensionFactorBasisPoints ||
    extensionComputation.adjustedProofEndsAt.getTime() !==
      currentAdjustedProofEndsAt.getTime() ||
    extensionComputation.adjustedRecoveryEndsAt.getTime() !==
      currentAdjustedRecoveryEndsAt.getTime();

  const observedAverageChanged =
    (sub.guaranteeObservedMonthlyLeadAverage ?? null) !==
    observedMonthlyLeadAverage;

  const needsUpdate = extensionChanged || observedAverageChanged;
  if (needsUpdate) {
    await withTransaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({
          guaranteeObservedMonthlyLeadAverage: observedMonthlyLeadAverage,
          guaranteeExtensionFactorBasisPoints:
            extensionComputation.extensionFactorBasisPoints,
          guaranteeAdjustedProofEndsAt:
            extensionComputation.adjustedProofEndsAt,
          guaranteeAdjustedRecoveryEndsAt:
            extensionComputation.adjustedRecoveryEndsAt,
          guaranteeNotes: extensionFactorIncreased
            ? `${sub.guaranteeNotes ? `${sub.guaranteeNotes} ` : ''}Low-volume extension applied: observed ${observedMonthlyLeadAverage} leads/month (${leadCount} leads over ${proofStartAt.toISOString().slice(0, 10)}-${observedPeriodEnd.toISOString().slice(0, 10)}).`
            : sub.guaranteeNotes,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));

      if (extensionFactorIncreased) {
        await tx.insert(billingEvents).values({
          clientId: sub.clientId,
          subscriptionId: sub.id,
          eventType: 'guarantee_extension_applied',
          description:
            `Low-volume extension applied at ${observedMonthlyLeadAverage} leads/month average.`,
          rawData: {
            observedMonthlyLeadAverage,
            observedLeadCount: leadCount,
            proofStartAt: proofStartAt.toISOString(),
            observedPeriodEnd: observedPeriodEnd.toISOString(),
            previousFactorBasisPoints: currentExtensionFactorBasisPoints,
            newFactorBasisPoints:
              extensionComputation.extensionFactorBasisPoints,
            adjustedProofEndsAt:
              extensionComputation.adjustedProofEndsAt.toISOString(),
            adjustedRecoveryEndsAt:
              extensionComputation.adjustedRecoveryEndsAt.toISOString(),
          },
        });
      }
    });
  }

  return {
    extensionUpdated: needsUpdate,
    windowContext: {
      proofWindowStart: proofStartAt,
      proofWindowEnd: extensionComputation.adjustedProofEndsAt,
      recoveryWindowStart: recoveryStartAt,
      recoveryWindowEnd: extensionComputation.adjustedRecoveryEndsAt,
    },
  };
}

function toOpportunityAuditPayload(opportunities: AttributedOpportunity[]) {
  return opportunities.map((opportunity) => ({
    leadId: opportunity.leadId,
    reason: opportunity.reason,
    evidenceAt: opportunity.evidenceAt.toISOString(),
    firstAutomationAt: opportunity.firstAutomationAt.toISOString(),
  }));
}

function getPrimaryAttributedOpportunity(opportunities: AttributedOpportunity[]) {
  if (opportunities.length === 0) return null;

  const sorted = [...opportunities].sort(
    (a, b) => a.evidenceAt.getTime() - b.evidenceAt.getTime()
  );
  return sorted[0];
}

async function transitionProofPassed(
  sub: GuaranteeCandidate,
  now: Date,
  windowContext: GuaranteeWindowContext,
  qleMetrics: { count: number; qualifiedLeadIds: string[] }
) {
  const db = getDb();
  await withTransaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        guaranteeStatus: 'proof_passed',
        guaranteeProofQualifiedLeadEngagements: qleMetrics.count,
        guaranteeFulfilledAt: null,
        guaranteeRefundEligibleAt: null,
        guaranteeNotes:
          `Proof-of-life passed with ${qleMetrics.count} qualified lead engagements. Recovery window now active.`,
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
        proofWindowStart: windowContext.proofWindowStart.toISOString(),
        proofWindowEnd: windowContext.proofWindowEnd.toISOString(),
      },
    });
  });
}

async function transitionProofFailedRefundReview(
  sub: GuaranteeCandidate,
  now: Date,
  windowContext: GuaranteeWindowContext,
  qleMetrics: { count: number; qualifiedLeadIds: string[] }
) {
  const db = getDb();
  await withTransaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        guaranteeStatus: 'proof_failed_refund_review',
        guaranteeProofQualifiedLeadEngagements: qleMetrics.count,
        guaranteeRefundEligibleAt: now,
        guaranteeNotes:
          `Proof-of-life missed: ${qleMetrics.count} qualified lead engagements in proof window. Action: review first-month refund eligibility.`,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    await tx.insert(billingEvents).values({
      clientId: sub.clientId,
      subscriptionId: sub.id,
      eventType: 'guarantee_proof_refund_review_required',
      description:
        `Proof-of-life missed (${qleMetrics.count} qualified lead engagements). Refund review required.`,
      rawData: {
        qualifiedLeadEngagements: qleMetrics.count,
        qualifiedLeadIds: qleMetrics.qualifiedLeadIds,
        proofWindowStart: windowContext.proofWindowStart.toISOString(),
        proofWindowEnd: windowContext.proofWindowEnd.toISOString(),
        actionHint: 'Review first-month proof-of-life refund criteria and process if eligible.',
      },
    });
  });
}

async function transitionRecoveryPending(
  sub: GuaranteeCandidate,
  now: Date,
  windowContext: GuaranteeWindowContext,
  recoveryMetrics: RecoveryAttributedOpportunityMetrics
) {
  const db = getDb();
  await withTransaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        guaranteeStatus: 'recovery_pending',
        guaranteeRecoveryAttributedOpportunities: recoveryMetrics.count,
        guaranteeNotes:
          `Recovery window in progress: ${recoveryMetrics.count} attributed opportunities so far.`,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    await tx.insert(billingEvents).values({
      clientId: sub.clientId,
      subscriptionId: sub.id,
      eventType: 'guarantee_recovery_started',
      description: 'Proof-of-life passed. 90-day recovery window started.',
      rawData: {
        recoveryWindowStart: windowContext.recoveryWindowStart.toISOString(),
        recoveryWindowEnd: windowContext.recoveryWindowEnd.toISOString(),
        attributedOpportunities: recoveryMetrics.count,
        opportunities: toOpportunityAuditPayload(recoveryMetrics.opportunities),
      },
    });
  });
}

async function transitionRecoveryPassed(
  sub: GuaranteeCandidate,
  now: Date,
  windowContext: GuaranteeWindowContext,
  recoveryMetrics: RecoveryAttributedOpportunityMetrics
) {
  const db = getDb();
  const primaryOpportunity = getPrimaryAttributedOpportunity(recoveryMetrics.opportunities);

  await withTransaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        guaranteeStatus: 'recovery_passed',
        guaranteeRecoveryAttributedOpportunities: recoveryMetrics.count,
        guaranteeRecoveredLeadId: primaryOpportunity?.leadId ?? null,
        guaranteeFulfilledAt: now,
        guaranteeRefundEligibleAt: null,
        guaranteeNotes:
          `Recovery guarantee passed with ${recoveryMetrics.count} attributed opportunities in recovery window.`,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    await tx.insert(billingEvents).values({
      clientId: sub.clientId,
      subscriptionId: sub.id,
      eventType: 'guarantee_recovery_passed',
      description:
        `Recovery guarantee passed (${recoveryMetrics.count} attributed opportunities).`,
      rawData: {
        recoveryWindowStart: windowContext.recoveryWindowStart.toISOString(),
        recoveryWindowEnd: windowContext.recoveryWindowEnd.toISOString(),
        attributedOpportunities: recoveryMetrics.count,
        primaryAttributedLeadId: primaryOpportunity?.leadId ?? null,
        opportunities: toOpportunityAuditPayload(recoveryMetrics.opportunities),
      },
    });
  });
}

async function transitionRecoveryFailedRefundReview(
  sub: GuaranteeCandidate,
  now: Date,
  windowContext: GuaranteeWindowContext,
  recoveryMetrics: RecoveryAttributedOpportunityMetrics
) {
  const db = getDb();
  await withTransaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        guaranteeStatus: 'recovery_failed_refund_review',
        guaranteeRecoveryAttributedOpportunities: recoveryMetrics.count,
        guaranteeRefundEligibleAt: now,
        guaranteeNotes:
          `Recovery guarantee missed: ${recoveryMetrics.count} attributed opportunities by window end. Action: review 90-day refund eligibility.`,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    await tx.insert(billingEvents).values({
      clientId: sub.clientId,
      subscriptionId: sub.id,
      eventType: 'guarantee_recovery_refund_review_required',
      description:
        `Recovery guarantee missed (${recoveryMetrics.count} attributed opportunities). Refund review required.`,
      rawData: {
        recoveryWindowStart: windowContext.recoveryWindowStart.toISOString(),
        recoveryWindowEnd: windowContext.recoveryWindowEnd.toISOString(),
        attributedOpportunities: recoveryMetrics.count,
        opportunities: toOpportunityAuditPayload(recoveryMetrics.opportunities),
        actionHint: 'Review 90-day refund criteria and process refund if eligible.',
      },
    });
  });
}

async function persistProofProgress(
  sub: GuaranteeCandidate,
  now: Date,
  qleCount: number
) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({
      guaranteeProofQualifiedLeadEngagements: qleCount,
      guaranteeNotes: `Proof-of-life in progress: ${qleCount} qualified lead engagements so far.`,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));
}

async function persistRecoveryProgress(
  sub: GuaranteeCandidate,
  now: Date,
  recoveryMetrics: RecoveryAttributedOpportunityMetrics
) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({
      guaranteeRecoveryAttributedOpportunities: recoveryMetrics.count,
      guaranteeNotes:
        `Recovery window in progress: ${recoveryMetrics.count} attributed opportunities so far.`,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));
}

export async function processGuaranteeStatus(): Promise<GuaranteeRunResult> {
  const db = getDb();
  const now = new Date();
  const result: GuaranteeRunResult = {
    checked: 0,
    proofPassed: 0,
    proofFailedRefundReview: 0,
    recoveryPendingStarted: 0,
    recoveryPassed: 0,
    recoveryFailedRefundReview: 0,
    extensionUpdated: 0,
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
      guaranteeObservedMonthlyLeadAverage: subscriptions.guaranteeObservedMonthlyLeadAverage,
      guaranteeExtensionFactorBasisPoints: subscriptions.guaranteeExtensionFactorBasisPoints,
      guaranteeNotes: subscriptions.guaranteeNotes,
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

  for (const sub of candidates as GuaranteeCandidate[]) {
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

    const lowVolumeExtensionResult = await applyLowVolumeExtensionAndSync(
      sub,
      backfill,
      now
    );
    const windowContext = lowVolumeExtensionResult.windowContext;
    if (lowVolumeExtensionResult.extensionUpdated) {
      result.extensionUpdated++;
    }
    let currentStatus: GuaranteeV2Status = backfill.guaranteeStatus;

    const qleMetrics = await countQualifiedLeadEngagements(
      sub.clientId,
      windowContext.proofWindowStart,
      windowContext.proofWindowEnd
    );

    const proofAction = evaluateProofWindowStatus({
      status: currentStatus,
      qualifiedLeadEngagements: qleMetrics.count,
      now,
      proofWindowEnd: windowContext.proofWindowEnd,
    });

    if (proofAction === 'proof_pass') {
      await transitionProofPassed(sub, now, windowContext, qleMetrics);
      currentStatus = 'proof_passed';
      result.proofPassed++;
    }

    if (proofAction === 'proof_fail_refund_review') {
      await transitionProofFailedRefundReview(sub, now, windowContext, qleMetrics);
      currentStatus = 'proof_failed_refund_review';
      result.proofFailedRefundReview++;
      continue;
    }

    if (currentStatus === 'proof_pending') {
      await persistProofProgress(sub, now, qleMetrics.count);
      continue;
    }

    if (currentStatus !== 'proof_passed' && currentStatus !== 'recovery_pending') {
      continue;
    }

    const recoveryMetrics = await countRecoveryAttributedOpportunities(
      sub.clientId,
      windowContext.recoveryWindowStart,
      windowContext.recoveryWindowEnd
    );

    const probablePipelineValueCents = await calculateProbablePipelineValueCents(
      sub.clientId,
      windowContext.recoveryWindowStart,
      windowContext.recoveryWindowEnd
    );

    const recoveryAction = evaluateRecoveryWindowStatus({
      status: currentStatus,
      attributedOpportunities: recoveryMetrics.count,
      probablePipelineValueCents,
      now,
      recoveryWindowEnd: windowContext.recoveryWindowEnd,
    });

    if (recoveryAction === 'move_to_recovery_pending') {
      await transitionRecoveryPending(sub, now, windowContext, recoveryMetrics);
      result.recoveryPendingStarted++;
      continue;
    }

    if (recoveryAction === 'recovery_pass') {
      await transitionRecoveryPassed(sub, now, windowContext, recoveryMetrics);
      result.recoveryPassed++;
      continue;
    }

    if (recoveryAction === 'recovery_fail_refund_review') {
      await transitionRecoveryFailedRefundReview(sub, now, windowContext, recoveryMetrics);
      result.recoveryFailedRefundReview++;
      continue;
    }

    if (currentStatus === 'recovery_pending') {
      await persistRecoveryProgress(sub, now, recoveryMetrics);
    }
  }

  return result;
}
