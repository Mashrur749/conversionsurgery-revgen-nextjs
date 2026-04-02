import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema/knowledge-base';
import { eq, and } from 'drizzle-orm';
import { KnowledgeList } from './knowledge-list';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { Breadcrumbs } from '@/components/breadcrumbs';

export const dynamic = 'force-dynamic';

interface KnowledgeBasePageProps {
  searchParams: Promise<{ add?: string }>;
}

export default async function KnowledgeBasePage({ searchParams }: KnowledgeBasePageProps) {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.KNOWLEDGE_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { add: prefillQuestion } = await searchParams;

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
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Knowledge Base' }]} />
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm">
          Manage what your AI assistant knows about your business. The more detail you add, the better it can answer customer questions.
        </p>
      </div>
      <KnowledgeList grouped={grouped} prefillQuestion={prefillQuestion} />
    </div>
  );
}
