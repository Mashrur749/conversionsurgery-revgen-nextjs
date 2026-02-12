import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, reviewSources } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { ReviewSource } from '@/db/schema/review-sources';

export default async function ReputationPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  const allClients = await db
    .select()
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  const allSources: ReviewSource[] = await db.select().from(reviewSources);

  // Group sources by client
  const sourcesByClient = new Map<string, ReviewSource[]>();
  for (const source of allSources) {
    if (!source.clientId) continue;
    const existing = sourcesByClient.get(source.clientId) || [];
    existing.push(source);
    sourcesByClient.set(source.clientId, existing);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reputation Monitoring</h1>
        <p className="text-muted-foreground">
          Track reviews across all clients
        </p>
      </div>

      <div className="grid gap-4">
        {allClients.map((client) => {
          const clientSources = sourcesByClient.get(client.id) || [];
          const totalReviews = clientSources.reduce(
            (sum, s) => sum + (s.totalReviews || 0),
            0
          );
          const weightedRating = clientSources.reduce(
            (sum, s) => sum + (s.averageRating || 0) * (s.totalReviews || 0),
            0
          );
          const avgRating =
            totalReviews > 0
              ? Math.round((weightedRating / totalReviews) * 10) / 10
              : null;

          return (
            <Card key={client.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold">{client.businessName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {client.ownerName}
                      </p>
                    </div>

                    {clientSources.length > 0 ? (
                      <div className="flex items-center gap-3">
                        {avgRating && (
                          <div className="text-lg font-bold">
                            {avgRating} / 5.0
                          </div>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {totalReviews} reviews
                        </span>
                        <div className="flex gap-1">
                          {clientSources.map((s) => (
                            <Badge
                              key={s.id}
                              variant={s.isActive ? 'default' : 'secondary'}
                            >
                              {s.source}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline">No sources linked</Badge>
                    )}
                  </div>

                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/clients/${client.id}/reviews`}>
                      {clientSources.length > 0
                        ? 'View Reviews'
                        : 'Setup'}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {allClients.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No active clients found.
          </div>
        )}
      </div>
    </div>
  );
}
