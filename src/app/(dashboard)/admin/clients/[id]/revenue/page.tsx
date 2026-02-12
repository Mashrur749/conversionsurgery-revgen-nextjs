import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getRevenueStats, getRecentJobs } from '@/lib/services/revenue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RevenueMetrics } from './revenue-metrics';
import { JobsList } from './jobs-list';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RevenuePage({ params }: Props) {
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

  if (!client) notFound();

  const [stats, jobsList] = await Promise.all([
    getRevenueStats(id),
    getRecentJobs(id, 20),
  ]);

  const monthlyCost = 997 * 100; // cents
  const roi = monthlyCost > 0 ? Math.round((stats.totalWonValue / monthlyCost) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Revenue Attribution</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${id}`}>Back</Link>
        </Button>
      </div>

      <RevenueMetrics stats={stats} roi={roi} />

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <JobsList clientId={id} jobs={jobsList} />
        </CardContent>
      </Card>
    </div>
  );
}
