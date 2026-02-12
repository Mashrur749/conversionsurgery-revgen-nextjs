import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ReviewDashboard } from '@/components/reviews/review-dashboard';
import { ReviewSourceConfig } from './review-source-config';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientReviewsPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">
            Reviews - {client.businessName}
          </h1>
          <p className="text-muted-foreground">
            Monitor and respond to customer reviews
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${id}`}>Back to Client</Link>
        </Button>
      </div>

      <ReviewSourceConfig clientId={id} businessName={client.businessName} />
      <ReviewDashboard clientId={id} />
    </div>
  );
}
