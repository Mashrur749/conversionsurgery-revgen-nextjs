import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EscalationQueue } from '@/components/escalations/escalation-queue';

export default async function EscalationsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Get clientId from session (non-admin users have it on session.client)
  const clientId = (session as any).client?.id;

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Escalation Queue</h1>
        <p className="text-muted-foreground">
          Conversations that need human attention
        </p>
      </div>

      <EscalationQueue
        clientId={clientId}
        isAdmin={(session as any).user?.isAdmin}
      />
    </div>
  );
}
