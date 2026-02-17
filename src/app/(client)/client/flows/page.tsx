import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { flows } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { FlowManagement } from './flow-management';

export default async function ClientFlowsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();
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
