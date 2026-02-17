import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KnowledgeEntryForm } from '../knowledge-entry-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewKnowledgeEntryPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Add Knowledge Entry</h1>
      <Card>
        <CardHeader>
          <CardTitle>Entry Details</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeEntryForm clientId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
