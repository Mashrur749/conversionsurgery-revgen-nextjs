import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { npsSurveys } from '@/db/schema';
import { eq, desc, avg, count, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default async function NpsDashboardPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const db = getDb();

  const [stats] = await db
    .select({
      totalSent: count(),
      avgScore: avg(npsSurveys.score),
      responded: count(npsSurveys.respondedAt),
    })
    .from(npsSurveys);

  const recentResponses = await db
    .select()
    .from(npsSurveys)
    .where(eq(npsSurveys.status, 'responded'))
    .orderBy(desc(npsSurveys.respondedAt))
    .limit(20);

  const avgScoreNum = stats.avgScore ? parseFloat(String(stats.avgScore)) : 0;
  const responseRate = stats.totalSent > 0
    ? Math.round((Number(stats.responded) / Number(stats.totalSent)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NPS Surveys</h1>
        <p className="text-muted-foreground">Net Promoter Score tracking from post-appointment surveys.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Average NPS Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgScoreNum.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">out of 10</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Surveys Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Number(stats.totalSent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Response Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{responseRate}%</p>
            <p className="text-xs text-muted-foreground">{Number(stats.responded)} responses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Responses</CardTitle>
        </CardHeader>
        <CardContent>
          {recentResponses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-2">No responses yet</p>
              <p className="text-sm text-muted-foreground">NPS responses will appear here after surveys are sent to clients.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentResponses.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-[#F8F9FA] transition-colors rounded-md px-2 -mx-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        (r.score || 0) >= 9 ? 'default' :
                        (r.score || 0) >= 7 ? 'secondary' : 'destructive'
                      }>
                        {r.score}/10
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.respondedAt ? format(new Date(r.respondedAt), 'MMM d, h:mm a') : ''}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-sm mt-1">{r.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
