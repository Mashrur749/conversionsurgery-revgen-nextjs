import { NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { subscriptions, plans, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/admin/billing/subscriptions */
export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_VIEW);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const db = getDb();

  const results = await db
    .select({
      clientName: clients.businessName,
      planName: plans.name,
      status: subscriptions.status,
      priceMonthly: plans.priceMonthly,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .innerJoin(clients, eq(subscriptions.clientId, clients.id))
    .orderBy(subscriptions.createdAt);

  return NextResponse.json({ subscriptions: results });
}
