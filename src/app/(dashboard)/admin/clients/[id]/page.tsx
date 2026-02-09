import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients, teamMembers } from '@/db';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { EditClientForm } from './edit-client-form';
import { TeamManager } from './team-manager';
import { DeleteButton } from './delete-button';
import { format } from 'date-fns';

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

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.clientId, client.id))
    .orderBy(teamMembers.priority);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.businessName}</h1>
            <Badge className={statusColors[client.status || 'pending']}>
              {client.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Created {format(new Date(client.createdAt!), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin">← Back to Clients</Link>
          </Button>
          {!client.twilioNumber && (
            <Button asChild>
              <Link href={`/admin/clients/${client.id}/phone`}>
                Assign Phone Number
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Edit business details</CardDescription>
          </CardHeader>
          <CardContent>
            <EditClientForm client={client} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Phone Number</CardTitle>
            </CardHeader>
            <CardContent>
              {client.twilioNumber ? (
                <div className="space-y-2">
                  <p className="text-2xl font-mono">
                    {formatPhoneNumber(client.twilioNumber)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Webhooks configured automatically
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/clients/${client.id}/phone`}>
                      Change Number
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">
                    No phone number assigned yet
                  </p>
                  <Button asChild>
                    <Link href={`/admin/clients/${client.id}/phone`}>
                      Assign Phone Number
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>{members.length} members</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No team members configured
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex justify-between items-center text-sm">
                      <span>{member.name}</span>
                      <Badge variant={member.isActive ? 'default' : 'secondary'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages this month</span>
                <span className="font-medium">
                  {client.messagesSentThisMonth} / {client.monthlyMessageLimit}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/clients/${client.id}/knowledge`}>
                  Knowledge Base
                </Link>
              </Button>
              <DeleteButton clientId={client.id} clientName={client.businessName} status={client.status} />
            </CardContent>
          </Card>
        </div>
      </div>

      <TeamManager clientId={client.id} />
    </div>
  );
}
