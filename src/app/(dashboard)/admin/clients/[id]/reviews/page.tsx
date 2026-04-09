import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import { clients, reviewResponses, reviews } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ReviewDashboard } from '@/components/reviews/review-dashboard';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ReviewSourceConfig } from './review-source-config';
import { GoogleConnectionCard } from './google-connection';
import { PendingResponsesAdmin } from './pending-responses-admin';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientReviewsPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAgency) {
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

  // Fetch pending review responses for operator approval
  const pendingResponses = await db
    .select({
      id: reviewResponses.id,
      reviewId: reviewResponses.reviewId,
      responseText: reviewResponses.responseText,
      status: reviewResponses.status,
      authorName: reviews.authorName,
      rating: reviews.rating,
      reviewText: reviews.reviewText,
      createdAt: reviewResponses.createdAt,
    })
    .from(reviewResponses)
    .innerJoin(reviews, eq(reviewResponses.reviewId, reviews.id))
    .where(
      and(
        eq(reviewResponses.clientId, id),
        inArray(reviewResponses.status, ['draft', 'pending_approval'])
      )
    )
    .orderBy(reviewResponses.createdAt);

  const serializedPending = pendingResponses.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Clients', href: '/admin/clients' },
        { label: client.businessName, href: `/admin/clients/${id}` },
        { label: 'Reviews' },
      ]} />
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

      {/* Pending responses for operator approval */}
      <PendingResponsesAdmin clientId={id} responses={serializedPending} />

      <GoogleConnectionCard
        clientId={id}
        status={
          client.googleAccessToken
            ? client.googleTokenExpiresAt && new Date(client.googleTokenExpiresAt) < new Date()
              ? 'expired'
              : 'connected'
            : 'not_connected'
        }
        accountId={client.googleBusinessAccountId}
      />

      <ReviewSourceConfig clientId={id} businessName={client.businessName} />
      <ReviewDashboard clientId={id} />
    </div>
  );
}
