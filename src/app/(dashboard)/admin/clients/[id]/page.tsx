import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { TeamManager } from './team-manager';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{client.businessName}</h1>
          <p className="text-muted-foreground">{client.ownerName}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/clients">← Back to Clients</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{formatPhoneNumber(client.phone)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timezone</p>
              <p className="font-medium">{client.timezone}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Client Status</p>
              <Badge
                className="mt-1"
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
            {client.twilioNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-mono font-medium mt-1">
                  {formatPhoneNumber(client.twilioNumber)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage this client</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href={`/admin/clients/${client.id}/phone`}>
              {client.twilioNumber ? 'Change Phone Number' : 'Assign Phone Number'}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <TeamManager clientId={client.id} />
    </div>
  );
}
