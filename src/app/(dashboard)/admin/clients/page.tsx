import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';

export default async function AdminClientsPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();
  const allClients = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage all client accounts</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/twilio">Twilio Account</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/clients/new">+ New Client</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {allClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex-1">
                  <p className="font-semibold">{client.businessName}</p>
                  <p className="text-sm text-muted-foreground">{client.email}</p>
                  {client.twilioNumber && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatPhoneNumber(client.twilioNumber)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      client.status === 'active'
                        ? 'default'
                        : client.status === 'pending'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {client.status}
                  </Badge>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/clients/${client.id}`}>View</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/admin/clients/${client.id}/phone`}>Phone</Link>
                  </Button>
                </div>
              </div>
            ))}

            {allClients.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No clients found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
