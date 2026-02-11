import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb, leads } from '@/db';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { LeadScoreBadge } from '@/components/leads/lead-score-badge';

export const dynamic = 'force-dynamic';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  estimate_sent: 'bg-purple-100 text-purple-800',
  appointment_scheduled: 'bg-indigo-100 text-indigo-800',
  action_required: 'bg-red-100 text-red-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
  opted_out: 'bg-gray-100 text-gray-800',
};

export default async function LeadsPage() {
  const session = await auth();
  const clientId = await getClientId();

  if (session?.user?.isAdmin && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-2">Select a Client</h2>
        <p className="text-muted-foreground">
          Use the dropdown in the header to select a client to view.
        </p>
      </div>
    );
  }

  if (!clientId) {
    return <div>No client linked</div>;
  }

  const db = getDb();

  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.clientId, clientId))
    .orderBy(desc(leads.updatedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">{allLeads.length} total leads</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {allLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No leads yet. They'll appear here when someone calls or submits a form.
              </div>
            ) : (
              allLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 md:p-4 hover:bg-gray-50 transition-colors gap-2"
                >
                  <div className="flex items-center gap-3">
                    {lead.actionRequired && (
                      <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {lead.name || formatPhoneNumber(lead.phone)}
                      </p>
                      {lead.name && (
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(lead.phone)}
                        </p>
                      )}
                      {lead.projectType && (
                        <p className="text-sm text-muted-foreground truncate">
                          {lead.projectType}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pl-5 sm:pl-0">
                    <LeadScoreBadge
                      score={lead.score || 50}
                      temperature={(lead.temperature as 'hot' | 'warm' | 'cold') || 'warm'}
                      compact
                    />
                    <Badge className={statusColors[lead.status || 'new'] || statusColors.new}>
                      {lead.status?.replace(/_/g, ' ') || 'new'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.updatedAt!), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
