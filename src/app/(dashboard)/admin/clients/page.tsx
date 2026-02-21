import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ClientsFilter } from './clients-filter';

export default async function AdminClientsPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
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
            <Link href="/admin/clients/new/wizard">+ New Client</Link>
          </Button>
        </div>
      </div>

      <ClientsFilter allClients={allClients} />
    </div>
  );
}
