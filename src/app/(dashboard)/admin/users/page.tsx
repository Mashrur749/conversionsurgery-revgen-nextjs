import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb, users, clients } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { UserActions } from './user-actions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      clientName: clients.businessName,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(clients, eq(users.clientId, clients.id))
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
          <Link href="/admin">← Back to Clients</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {allUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{user.name || 'No name'}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.clientName && (
                    <p className="text-xs text-muted-foreground">
                      → {user.clientName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
                  </span>
                  {user.isAdmin && (
                    <Badge className="bg-amber-100 text-amber-800">Admin</Badge>
                  )}
                  <UserActions
                    user={user}
                    clients={allClients}
                    currentUserId={session.user!.id!}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
