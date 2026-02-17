import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, reviewSources, reviewMetrics } from '@/db/schema';
import { eq, desc, sql, sum } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Star, MessageSquare, TrendingUp, BarChart3 } from 'lucide-react';
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

  // Platform-wide review metrics (latest weekly period per client, then aggregate)
  const latestMetrics = await db
    .select({
      totalReviews: sum(reviewMetrics.totalReviews),
      avgRating: sql<number>`round(avg(${reviewMetrics.averageRating})::numeric, 1)`,
      respondedCount: sum(reviewMetrics.respondedCount),
      fiveStarCount: sum(reviewMetrics.fiveStarCount),
      oneStarCount: sum(reviewMetrics.oneStarCount),
    })
    .from(reviewMetrics)
    .where(eq(reviewMetrics.period, 'weekly'));

  const metrics = latestMetrics[0];
  const platformTotalReviews = Number(metrics?.totalReviews ?? 0);
  const platformAvgRating = Number(metrics?.avgRating ?? 0);
  const platformResponded = Number(metrics?.respondedCount ?? 0);
  const platformResponseRate = platformTotalReviews > 0
    ? Math.round((platformResponded / platformTotalReviews) * 100)
    : 0;

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

      {platformTotalReviews > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Star className="h-4 w-4" /> Avg Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{platformAvgRating} / 5.0</p>
              <p className="text-xs text-muted-foreground">Platform-wide average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-4 w-4" /> Total Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{platformTotalReviews.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Across all clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> Response Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{platformResponseRate}%</p>
              <p className="text-xs text-muted-foreground">{platformResponded} of {platformTotalReviews} responded</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Responded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{platformResponded.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Reviews with responses</p>
            </CardContent>
          </Card>
        </div>
      )}

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
            <Card key={client.id} className="hover:bg-[#F8F9FA] transition-colors">
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
