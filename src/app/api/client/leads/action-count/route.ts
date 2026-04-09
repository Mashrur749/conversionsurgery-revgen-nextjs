import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and, count as countFn } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  async ({ session }) => {
    const db = getDb();

    const [result] = await db
      .select({ count: countFn() })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, session.clientId),
          eq(leads.actionRequired, true)
        )
      );

    return NextResponse.json({ count: Number(result?.count ?? 0) });
  }
);
