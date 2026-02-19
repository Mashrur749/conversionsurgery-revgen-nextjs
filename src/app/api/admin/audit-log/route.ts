import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { getDb } from '@/db';
import { auditLog, people, clients } from '@/db/schema';
import { eq, desc, and, gte, lte, count, SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    requireAdmin(session);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const action = searchParams.get('action');
    const personId = searchParams.get('personId');
    const clientId = searchParams.get('clientId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const db = getDb();

    // Build where conditions
    const conditions: SQL[] = [];

    if (action) {
      conditions.push(eq(auditLog.action, action));
    }
    if (personId) {
      conditions.push(eq(auditLog.personId, personId));
    }
    if (clientId) {
      conditions.push(eq(auditLog.clientId, clientId));
    }
    if (from) {
      conditions.push(gte(auditLog.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(auditLog.createdAt, new Date(to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ total: count() })
      .from(auditLog)
      .where(whereClause);

    const total = countResult?.total || 0;

    // Get paginated results with joins
    const offset = (page - 1) * limit;

    const entries = await db
      .select({
        id: auditLog.id,
        personId: auditLog.personId,
        personName: people.name,
        personEmail: people.email,
        clientId: auditLog.clientId,
        clientName: clients.businessName,
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        metadata: auditLog.metadata,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(people, eq(auditLog.personId, people.id))
      .leftJoin(clients, eq(auditLog.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('admin access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('GET /api/admin/audit-log error:', error);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
