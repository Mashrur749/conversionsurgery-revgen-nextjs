import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import { flowTemplates, flows, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PushUpdateView } from '@/components/flows/push-update-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PushUpdatePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const { id } = await params;
  const db = getDb();

  const [template] = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, id))
    .limit(1);

  if (!template) notFound();

  // Get all flows using this template with client info
  const usage = await db
    .select({
      flowId: flows.id,
      flowName: flows.name,
      syncMode: flows.syncMode,
      templateVersion: flows.templateVersion,
      clientId: clients.id,
      clientName: clients.businessName,
    })
    .from(flows)
    .innerJoin(clients, eq(flows.clientId, clients.id))
    .where(eq(flows.templateId, id));

  return (
    <div>
      <PushUpdateView
        template={{
          id: template.id,
          name: template.name,
          version: template.version ?? 1,
        }}
        usage={usage}
      />
    </div>
  );
}
