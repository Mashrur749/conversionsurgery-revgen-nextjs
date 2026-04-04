import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, knowledgeBase } from '@/db';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KnowledgeEntryForm } from '../knowledge-entry-form';
import { Breadcrumbs } from '@/components/breadcrumbs';

interface Props {
  params: Promise<{ id: string; entryId: string }>;
}

export default async function EditKnowledgeEntryPage({ params }: Props) {
  const { id, entryId } = await params;
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const db = getDb();
  const [entry] = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.id, entryId))
    .limit(1);

  if (!entry) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Breadcrumbs items={[
        { label: 'Clients', href: '/admin/clients' },
        { label: 'Knowledge Base', href: `/admin/clients/${id}/knowledge` },
        { label: 'Entry' },
      ]} />
      <Card>
        <CardHeader>
          <CardTitle>Edit Knowledge Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeEntryForm clientId={id} entry={entry} />
        </CardContent>
      </Card>
    </div>
  );
}
