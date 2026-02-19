import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { auditLog, people, clients } from '@/db/schema';
import { desc, count, eq, and, gte, lte, SQL } from 'drizzle-orm';
import { AuditLogClient } from './audit-log-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  action?: string;
  personId?: string;
  clientId?: string;
  from?: string;
  to?: string;
}

export default async function AuditLogPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const searchParams = await searchParamsPromise;
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.limit || '50', 10)));

  const db = getDb();

  // Build where conditions
  const conditions: SQL[] = [];

  if (searchParams.action) {
    conditions.push(eq(auditLog.action, searchParams.action));
  }
  if (searchParams.personId) {
    conditions.push(eq(auditLog.personId, searchParams.personId));
  }
  if (searchParams.clientId) {
    conditions.push(eq(auditLog.clientId, searchParams.clientId));
  }
  if (searchParams.from) {
    conditions.push(gte(auditLog.createdAt, new Date(searchParams.from)));
  }
  if (searchParams.to) {
    conditions.push(lte(auditLog.createdAt, new Date(searchParams.to)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(auditLog)
    .where(whereClause);

  const total = countResult?.total || 0;
  const offset = (page - 1) * limit;

  // Get paginated results
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
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(people, eq(auditLog.personId, people.id))
    .leftJoin(clients, eq(auditLog.clientId, clients.id))
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  // Load filter options
  const allPeople = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .orderBy(people.name);

  const allClients = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .orderBy(clients.businessName);

  const serializedEntries = entries.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
    metadata: e.metadata as Record<string, unknown> | null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">
          Track who did what across the platform.
        </p>
      </div>

      <AuditLogClient
        entries={serializedEntries}
        pagination={{
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }}
        filters={{
          action: searchParams.action || '',
          personId: searchParams.personId || '',
          clientId: searchParams.clientId || '',
          from: searchParams.from || '',
          to: searchParams.to || '',
        }}
        people={allPeople}
        clients={allClients}
      />
    </div>
  );
}
