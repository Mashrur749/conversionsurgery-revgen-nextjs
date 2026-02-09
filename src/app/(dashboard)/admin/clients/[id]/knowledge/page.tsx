import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { getClientKnowledge, initializeClientKnowledge } from '@/lib/services/knowledge-base';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { KnowledgeList } from './knowledge-list';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KnowledgeBasePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) redirect('/dashboard');

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) notFound();

  await initializeClientKnowledge(id);
  const entries = await getClientKnowledge(id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${id}`}>← Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/clients/${id}/knowledge/new`}>+ Add Entry</Link>
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900">How AI Uses This</h3>
        <p className="text-sm text-blue-700 mt-1">
          When leads ask questions, the AI uses this knowledge base to give accurate,
          business-specific answers. Update this information to help the AI respond correctly.
        </p>
      </div>

      <KnowledgeList clientId={id} entries={entries} />
    </div>
  );
}
