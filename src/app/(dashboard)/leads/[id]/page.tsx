import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { conversations } from '@/db/schema/conversations';
import { scheduledMessages } from '@/db/schema/scheduled-messages';
import { mediaAttachments } from '@/db/schema/media-attachments';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { getClientId } from '@/lib/get-client-id';
import { ReplyForm } from './reply-form';
import { ActionButtons } from './action-buttons';
import { LeadTabs } from './lead-tabs';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

/** Server component displaying full lead details, conversation history, and scheduled messages. */
export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.email) {
    return <div>Not authenticated</div>;
  }

  const clientId = await getClientId();

  if (!clientId) {
    return <div>No client linked to your account. Please contact your administrator.</div>;
  }

  const db = getDb();

  const leadResult = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
    .limit(1);

  if (!leadResult.length) {
    notFound();
  }

  const lead = leadResult[0];

  const messages = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(conversations.createdAt);

  // Fetch media for this lead, grouped by messageId
  const media = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.leadId, lead.id));

  const mediaByMessage: Record<string, typeof media> = {};
  for (const m of media) {
    if (m.messageId) {
      if (!mediaByMessage[m.messageId]) {
        mediaByMessage[m.messageId] = [];
      }
      mediaByMessage[m.messageId].push(m);
    }
  }

  const scheduled = await db
    .select()
    .from(scheduledMessages)
    .where(and(
      eq(scheduledMessages.leadId, lead.id),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ))
    .orderBy(scheduledMessages.sendAt);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">
            {lead.name || formatPhoneNumber(lead.phone)}
          </h1>
          <p className="text-muted-foreground">{formatPhoneNumber(lead.phone)}</p>
          {lead.email && <p className="text-muted-foreground">{lead.email}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge>{lead.status}</Badge>
          {lead.actionRequired && (
            <Badge variant="destructive">Action Required</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <LeadTabs
            leadId={lead.id}
            messages={messages}
            mediaByMessage={mediaByMessage}
            mediaCount={media.length}
          >
            {!lead.optedOut && (
              <ReplyForm leadId={lead.id} leadPhone={lead.phone} />
            )}

            {lead.optedOut && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="py-4">
                  <p className="text-yellow-800">
                    This lead has opted out of messages.
                  </p>
                </CardContent>
              </Card>
            )}
          </LeadTabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="font-medium">{lead.source || 'Unknown'}</p>
              </div>
              {lead.projectType && (
                <div>
                  <p className="text-muted-foreground">Project Type</p>
                  <p className="font-medium">{lead.projectType}</p>
                </div>
              )}
              {lead.address && (
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{lead.address}</p>
                </div>
              )}
              {lead.notes && (
                <div>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(lead.createdAt!), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </CardContent>
          </Card>

          <ActionButtons lead={lead} />

          {scheduled.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scheduled.map((msg) => (
                  <div key={msg.id} className="text-sm border-l-2 border-blue-200 pl-3">
                    <p className="text-muted-foreground">
                      {format(new Date(msg.sendAt), 'MMM d, h:mm a')}
                    </p>
                    <p className="truncate">{msg.content.substring(0, 50)}...</p>
                    <Badge variant="outline" className="mt-1">
                      {msg.sequenceType}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
