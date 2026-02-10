import { notFound } from 'next/navigation';
import { getDb, escalationQueue } from '@/db';
import { eq } from 'drizzle-orm';
import { EscalationDetail } from '@/components/escalations/escalation-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EscalationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = getDb();

  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, id))
    .limit(1);

  if (!escalation) notFound();

  return <EscalationDetail escalationId={id} />;
}
