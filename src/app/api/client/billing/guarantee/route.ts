import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { buildGuaranteeSummary } from '@/lib/services/guarantee-v2/summary';

/** GET /api/client/billing/guarantee */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session }) => {
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
      .where(eq(subscriptions.clientId, session.clientId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json({ guarantee: null });
    }

    return NextResponse.json({
      guarantee: buildGuaranteeSummary({
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
        guaranteeRecoveryAttributedOpportunities:
          subscription.guaranteeRecoveryAttributedOpportunities,
        guaranteeRefundEligibleAt: subscription.guaranteeRefundEligibleAt,
        guaranteeNotes: subscription.guaranteeNotes,
      }),
    });
  }
);
