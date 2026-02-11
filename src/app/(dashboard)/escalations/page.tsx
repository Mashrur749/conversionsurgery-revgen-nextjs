import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getClientId } from '@/lib/get-client-id';
import { EscalationQueue } from '@/components/escalations/escalation-queue';

export default async function EscalationsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const clientId = await getClientId();

  if (session.user?.isAdmin && !clientId) {
    return (
      <div className="container py-6">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold mb-2">Select a Client</h2>
          <p className="text-muted-foreground">
            Use the dropdown in the header to select a client to view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Escalation Queue</h1>
        <p className="text-muted-foreground">
          Conversations that need human attention
        </p>
      </div>

      <EscalationQueue
        clientId={clientId ?? undefined}
        isAdmin={(session as any).user?.isAdmin}
      />
    </div>
  );
}
