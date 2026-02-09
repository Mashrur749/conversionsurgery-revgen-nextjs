import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KnowledgeEntryForm } from '../knowledge-entry-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewKnowledgeEntryPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) redirect('/dashboard');

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add Knowledge Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeEntryForm clientId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
