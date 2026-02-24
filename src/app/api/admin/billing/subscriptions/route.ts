import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { subscriptions, plans, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildGuaranteeSummary } from '@/lib/services/guarantee-v2/summary';

/** GET /api/admin/billing/subscriptions */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.BILLING_VIEW },
  async () => {
    const db = getDb();

    const results = await db
      .select({
        clientName: clients.businessName,
        planName: plans.name,
        status: subscriptions.status,
        priceMonthly: plans.priceMonthly,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
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
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .innerJoin(clients, eq(subscriptions.clientId, clients.id))
      .orderBy(subscriptions.createdAt);

    const subscriptionsWithGuarantee = results.map((row) => ({
      clientName: row.clientName,
      planName: row.planName,
      status: row.status,
      priceMonthly: row.priceMonthly,
      currentPeriodEnd: row.currentPeriodEnd,
      createdAt: row.createdAt,
      guarantee: buildGuaranteeSummary({
        guaranteeStatus: row.guaranteeStatus,
        guaranteeProofStartAt: row.guaranteeProofStartAt,
        guaranteeProofEndsAt: row.guaranteeProofEndsAt,
        guaranteeRecoveryStartAt: row.guaranteeRecoveryStartAt,
        guaranteeRecoveryEndsAt: row.guaranteeRecoveryEndsAt,
        guaranteeAdjustedProofEndsAt: row.guaranteeAdjustedProofEndsAt,
        guaranteeAdjustedRecoveryEndsAt: row.guaranteeAdjustedRecoveryEndsAt,
        guaranteeObservedMonthlyLeadAverage: row.guaranteeObservedMonthlyLeadAverage,
        guaranteeExtensionFactorBasisPoints: row.guaranteeExtensionFactorBasisPoints,
        guaranteeProofQualifiedLeadEngagements: row.guaranteeProofQualifiedLeadEngagements,
        guaranteeRecoveryAttributedOpportunities: row.guaranteeRecoveryAttributedOpportunities,
        guaranteeRefundEligibleAt: row.guaranteeRefundEligibleAt,
        guaranteeNotes: row.guaranteeNotes,
      }),
    }));

    return NextResponse.json({ subscriptions: subscriptionsWithGuarantee });
  }
);
