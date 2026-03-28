import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { conversations, clients, leads } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string> = {
  wrong_tone: 'Wrong Tone',
  inaccurate: 'Inaccurate',
  too_pushy: 'Too Pushy',
  hallucinated: 'Hallucinated',
  off_topic: 'Off Topic',
  other: 'Other',
};

const REASON_COLORS: Record<string, string> = {
  wrong_tone: 'bg-[#FFF3E0] text-sienna',
  inaccurate: 'bg-[#FDEAE4] text-sienna',
  too_pushy: 'bg-[#FFF3E0] text-terracotta-dark',
  hallucinated: 'bg-[#FDEAE4] text-sienna',
  off_topic: 'bg-muted text-muted-foreground',
  other: 'bg-muted text-muted-foreground',
};

export default async function AIQualityPage() {
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const db = getDb();

  const flaggedMessages = await db
    .select({
      id: conversations.id,
      clientId: conversations.clientId,
      leadId: conversations.leadId,
      content: conversations.content,
      flagReason: conversations.flagReason,
      flagNote: conversations.flagNote,
      flaggedAt: conversations.flaggedAt,
      createdAt: conversations.createdAt,
      clientName: clients.businessName,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(conversations)
    .innerJoin(clients, eq(conversations.clientId, clients.id))
    .leftJoin(leads, eq(conversations.leadId, leads.id))
    .where(eq(conversations.flagged, true))
    .orderBy(desc(conversations.flaggedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Quality Review</h1>
        <p className="text-muted-foreground">
          Flagged AI messages across all clients. Review and fix knowledge base or prompt issues.
        </p>
      </div>

      {flaggedMessages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No flagged messages. AI quality looks good.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{flaggedMessages.length} flagged messages</p>
          {flaggedMessages.map((msg) => (
            <Card key={msg.id} className="hover:bg-gray-50 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={REASON_COLORS[msg.flagReason || 'other']}>
                        {REASON_LABELS[msg.flagReason || 'other']}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {msg.clientName}
                      </span>
                      {msg.flaggedAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.flaggedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{msg.content}</p>
                    {msg.flagNote && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {msg.flagNote}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/leads/${msg.leadId}`}
                    className="text-sm text-olive underline shrink-0"
                  >
                    View lead
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
