import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { flowTemplateVersions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.FLOWS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  const db = getDb();

  const versions = await db
    .select()
    .from(flowTemplateVersions)
    .where(eq(flowTemplateVersions.templateId, id))
    .orderBy(desc(flowTemplateVersions.version));

  return NextResponse.json(versions);
}
