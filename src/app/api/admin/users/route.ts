import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { users, clients, people, agencyMemberships, clientMemberships } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.TEAM_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const db = getDb();

  // Query users with both legacy fields and new schema data.
  // Legacy: users.isAdmin, users.clientId — still populated for pre-migration users.
  // New: users.personId → people (name, phone, email) → agencyMemberships/clientMemberships.
  const allUsers = await db
    .select({
      id: users.id,
      name: sql<string | null>`COALESCE(${people.name}, ${users.name})`,
      email: sql<string>`COALESCE(${people.email}, ${users.email})`,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      clientName: clients.businessName,
      personId: users.personId,
      hasAgencyAccess: sql<boolean>`${agencyMemberships.id} IS NOT NULL`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(clients, eq(users.clientId, clients.id))
    .leftJoin(people, eq(users.personId, people.id))
    .leftJoin(agencyMemberships, eq(people.id, agencyMemberships.personId))
    .orderBy(desc(users.createdAt))
    .limit(200);

  return NextResponse.json({ users: allUsers });
}
