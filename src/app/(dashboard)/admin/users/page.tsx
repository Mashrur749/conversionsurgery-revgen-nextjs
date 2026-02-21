import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { users, people, agencyMemberships, clientMemberships, clients } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserList } from './user-list';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  const allUsers = await db
    .select({
      id: users.id,
      name: sql<string | null>`COALESCE(${people.name}, ${users.name})`,
      email: sql<string>`COALESCE(${people.email}, ${users.email})`,
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
    .orderBy(desc(users.createdAt));

  const allClients = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user access and permissions</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">&larr; Back to Clients</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <UserList
            users={allUsers}
            clients={allClients}
            currentUserId={session.user!.id!}
          />
        </CardContent>
      </Card>
    </div>
  );
}
