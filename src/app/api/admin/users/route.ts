import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { users, people, agencyMemberships, clientMemberships, clients } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async () => {
    const db = getDb();

    const allUsers = await db
      .select({
        id: users.id,
        name: sql<string | null>`COALESCE(${people.name}, ${users.name})`,
        email: sql<string>`COALESCE(${people.email}, ${users.email})`,
        personId: users.personId,
        hasAgencyAccess: sql<boolean>`${agencyMemberships.id} IS NOT NULL`,
        clientId: sql<string | null>`${clientMemberships.clientId}`,
        clientName: sql<string | null>`${clients.businessName}`,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(people, eq(users.personId, people.id))
      .leftJoin(agencyMemberships, eq(people.id, agencyMemberships.personId))
      .leftJoin(clientMemberships, eq(people.id, clientMemberships.personId))
      .leftJoin(clients, eq(clientMemberships.clientId, clients.id))
      .orderBy(desc(users.createdAt))
      .limit(200);

    return NextResponse.json({ users: allUsers });
  }
);
