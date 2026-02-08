import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { CreateTestForm } from '../components/create-test-form';

export default async function CreateTestPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();
  const allClientsRaw = await db.select().from(clients);
  const allClients = allClientsRaw.filter((c) => c.status !== 'cancelled');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New A/B Test</h1>
        <p className="text-muted-foreground mt-2">
          Design an experiment to test different approaches with a client
        </p>
      </div>

      <CreateTestForm clients={allClients} />
    </div>
  );
}
