import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { leads, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

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
  
  if (!session?.user?.email) {
    return <div>Not authenticated</div>;
  }

  const db = getDb();

  // Fetch user with client info from database
  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!userRecord || userRecord.length === 0 || !userRecord[0].clientId) {
    return <div>No client linked</div>;
  }

  const clientId = userRecord[0].clientId;

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
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {lead.actionRequired && (
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <div>
                      <p className="font-medium">
                        {lead.name || formatPhoneNumber(lead.phone)}
                      </p>
                      {lead.name && (
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(lead.phone)}
                        </p>
                      )}
                      {lead.projectType && (
                        <p className="text-sm text-muted-foreground">
                          {lead.projectType}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
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
