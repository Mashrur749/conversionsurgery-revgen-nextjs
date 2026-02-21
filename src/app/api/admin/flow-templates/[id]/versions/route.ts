import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { flowTemplateVersions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.FLOWS_VIEW },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();

    const versions = await db
      .select()
      .from(flowTemplateVersions)
      .where(eq(flowTemplateVersions.templateId, id))
      .orderBy(desc(flowTemplateVersions.version));

    return NextResponse.json(versions);
  }
);
