import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { ClientUsageDetail } from '../components/client-usage-detail';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientUsagePage({ params }: PageProps) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const { clientId } = await params;

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) notFound();

  return (
    <div className="space-y-6">
      <ClientUsageDetail clientId={clientId} clientName={client.businessName} />
    </div>
  );
}
