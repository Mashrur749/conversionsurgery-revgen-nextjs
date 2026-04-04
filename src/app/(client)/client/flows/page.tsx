import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, flows } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { FlowManagement } from './flow-management';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default async function ClientFlowsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();

  const [clientRow] = await db
    .select({ serviceModel: clients.serviceModel })
    .from(clients)
    .where(eq(clients.id, session.clientId))
    .limit(1);

  if (clientRow?.serviceModel === 'managed') {
    redirect('/client');
  }

  const clientFlows = await db
    .select({
      id: flows.id,
      name: flows.name,
      description: flows.description,
      category: flows.category,
      trigger: flows.trigger,
      isActive: flows.isActive,
    })
    .from(flows)
    .where(eq(flows.clientId, session.clientId))
    .orderBy(flows.priority);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/client' },
        { label: 'Flows' },
      ]} />
      <div>
        <h1 className="text-2xl font-bold">Automation Flows</h1>
        <p className="text-sm text-muted-foreground">
          Manage which automated follow-up sequences are active for your account
        </p>
      </div>
      <FlowManagement flows={clientFlows} />
    </div>
  );
}
