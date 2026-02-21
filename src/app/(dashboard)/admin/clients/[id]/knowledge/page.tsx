import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { getClientKnowledge, initializeClientKnowledge } from '@/lib/services/knowledge-base';
import { loadStructuredKnowledge } from '@/lib/services/structured-knowledge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { KnowledgeList } from './knowledge-list';
import KnowledgeForm from './knowledge-form';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function KnowledgeBasePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) notFound();

  await initializeClientKnowledge(id);
  const entries = await getClientKnowledge(id);
  const structuredData = await loadStructuredKnowledge(id);

  const activeTab = tab === 'entries' ? 'entries' : 'interview';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${id}`}>Back</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${id}/knowledge/preview`}>Test AI</Link>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        <Link
          href={`/admin/clients/${id}/knowledge?tab=interview`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'interview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Guided Interview
        </Link>
        <Link
          href={`/admin/clients/${id}/knowledge?tab=entries`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'entries' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          All Entries ({entries.length})
        </Link>
      </div>

      {activeTab === 'interview' ? (
        <div>
          <div className="bg-sage-light border border-forest-light/30 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-forest">Structured Knowledge Interview</h3>
            <p className="text-sm text-forest mt-1">
              Answer these questions about the business. The AI will use this to respond
              accurately to leads. Start with an industry preset to save time.
            </p>
          </div>
          <KnowledgeForm clientId={id} initialData={structuredData} />
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-4">
            <Button asChild>
              <Link href={`/admin/clients/${id}/knowledge/new`}>+ Add Entry</Link>
            </Button>
          </div>
          <KnowledgeList clientId={id} entries={entries} />
        </div>
      )}
    </div>
  );
}
