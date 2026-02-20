import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { webhookLog } from '@/db/schema';
import { eq, desc, and, type SQL } from 'drizzle-orm';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const eventType = searchParams.get('eventType');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = getDb();

  const conditions: SQL[] = [];
  if (clientId) conditions.push(eq(webhookLog.clientId, clientId));
  if (eventType) conditions.push(eq(webhookLog.eventType, eventType));

  const logs = await db
    .select()
    .from(webhookLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(webhookLog.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ logs, page, limit });
}
