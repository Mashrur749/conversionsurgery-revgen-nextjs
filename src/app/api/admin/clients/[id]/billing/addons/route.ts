import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { addonBillingEvents, subscriptionInvoices } from '@/db/schema';
import { formatAddonLineItemDescription } from '@/lib/services/addon-billing-format';
import { type AddonPricingKey } from '@/lib/services/addon-pricing';

export const GET = adminClientRoute(
  {
    permission: AGENCY_PERMISSIONS.BILLING_VIEW,
    clientIdFrom: (params: { id: string }) => params.id,
  },
  async ({ clientId }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: addonBillingEvents.id,
        addonType: addonBillingEvents.addonType,
        sourceType: addonBillingEvents.sourceType,
        sourceRef: addonBillingEvents.sourceRef,
        periodStart: addonBillingEvents.periodStart,
        periodEnd: addonBillingEvents.periodEnd,
        quantity: addonBillingEvents.quantity,
        unitPriceCents: addonBillingEvents.unitPriceCents,
        totalCents: addonBillingEvents.totalCents,
        status: addonBillingEvents.status,
        disputeStatus: addonBillingEvents.disputeStatus,
        disputeNote: addonBillingEvents.disputeNote,
        disputedAt: addonBillingEvents.disputedAt,
        resolvedAt: addonBillingEvents.resolvedAt,
        resolvedBy: addonBillingEvents.resolvedBy,
        invoiceId: addonBillingEvents.invoiceId,
        invoiceNumber: subscriptionInvoices.invoiceNumber,
        invoiceLineItemRef: addonBillingEvents.invoiceLineItemRef,
        createdAt: addonBillingEvents.createdAt,
      })
      .from(addonBillingEvents)
      .leftJoin(subscriptionInvoices, eq(addonBillingEvents.invoiceId, subscriptionInvoices.id))
      .where(eq(addonBillingEvents.clientId, clientId))
      .orderBy(desc(addonBillingEvents.periodStart), desc(addonBillingEvents.createdAt))
      .limit(200);

    return NextResponse.json({
      events: rows.map((row) => ({
        ...row,
        description: formatAddonLineItemDescription(
          row.addonType as AddonPricingKey,
          row.quantity
        ),
      })),
    });
  }
);
