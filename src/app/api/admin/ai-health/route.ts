import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { aiHealthReports } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async () => {
    const db = getDb();
    const reports = await db
      .select()
      .from(aiHealthReports)
      .orderBy(desc(aiHealthReports.createdAt))
      .limit(12); // Last 12 weeks

    return NextResponse.json({ reports });
  }
);
