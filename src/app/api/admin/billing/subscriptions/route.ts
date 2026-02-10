import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/db';
import { subscriptions, plans, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
