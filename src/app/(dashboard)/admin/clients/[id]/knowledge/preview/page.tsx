import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { buildKnowledgeContext } from '@/lib/services/knowledge-base';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { KnowledgePreviewChat } from './preview-chat';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KnowledgePreviewPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) notFound();

  const knowledgeContext = await buildKnowledgeContext(id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Test AI Knowledge</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${id}/knowledge`}>Back</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Context (What AI Sees)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-[#F8F9FA] p-4 rounded max-h-[500px] overflow-auto">
              {knowledgeContext || 'No knowledge entries found. Add entries to the knowledge base first.'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <KnowledgePreviewChat clientId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
