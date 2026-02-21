import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ClientsFilter } from './clients-filter';
import { getAgencySession } from '@/lib/permissions';

export default async function AdminClientsPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const agencySession = await getAgencySession();
  if (!agencySession) {
    redirect('/dashboard');
  }

  const db = getDb();
  const baseQuery = db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  const allClients =
    agencySession.clientScope === 'assigned'
      ? (agencySession.assignedClientIds?.length
          ? await baseQuery.where(inArray(clients.id, agencySession.assignedClientIds))
          : [])
      : await baseQuery;

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
