import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema/knowledge-base';
import { eq, and } from 'drizzle-orm';
import { KnowledgeList } from './knowledge-list';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();
  const entries = await db
    .select()
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, session.clientId),
      eq(knowledgeBase.isActive, true)
    ))
    .orderBy(knowledgeBase.category, knowledgeBase.priority);

  // Group by category
  const grouped: Record<string, typeof entries> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) {
      grouped[entry.category] = [];
    }
    grouped[entry.category].push(entry);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm">
          Manage what your AI assistant knows about your business. The more detail you add, the better it can answer customer questions.
        </p>
      </div>
      <KnowledgeList grouped={grouped} />
    </div>
  );
}
