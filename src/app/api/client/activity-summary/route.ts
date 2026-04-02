import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb, leads, appointments, conversations, scheduledMessages } from '@/db';
import { eq, and, gte, sql, like } from 'drizzle-orm';

/** GET /api/client/activity-summary?since={ISO timestamp} */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session, request }) => {
    const { clientId } = session;
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');

    const sinceDate = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const db = getDb();

    const [leadsRespondedResult, estimatesFollowedUpResult, appointmentsBookedResult, actionsNeededResult] =
      await Promise.all([
        // leadsResponded: leads that had an outbound message since the timestamp
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${conversations.leadId})` })
          .from(conversations)
          .innerJoin(leads, eq(conversations.leadId, leads.id))
          .where(
            and(
              eq(conversations.clientId, clientId),
              eq(conversations.direction, 'outbound'),
              gte(conversations.createdAt, sinceDate)
            )
          ),

        // estimatesFollowedUp: scheduled_messages with sequenceType starting with 'estimate' sent since timestamp
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(scheduledMessages)
          .where(
            and(
              eq(scheduledMessages.clientId, clientId),
              like(scheduledMessages.sequenceType, 'estimate%'),
              eq(scheduledMessages.sent, true),
              gte(scheduledMessages.sentAt, sinceDate)
            )
          ),

        // appointmentsBooked: appointments created since timestamp
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(appointments)
          .where(
            and(
              eq(appointments.clientId, clientId),
              gte(appointments.createdAt, sinceDate)
            )
          ),

        // actionsNeeded: leads currently flagged action_required
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(leads)
          .where(
            and(
              eq(leads.clientId, clientId),
              eq(leads.actionRequired, true)
            )
          ),
      ]);

    return NextResponse.json({
      leadsResponded: Number(leadsRespondedResult[0]?.count ?? 0),
      estimatesFollowedUp: Number(estimatesFollowedUpResult[0]?.count ?? 0),
      appointmentsBooked: Number(appointmentsBookedResult[0]?.count ?? 0),
      actionsNeeded: Number(actionsNeededResult[0]?.count ?? 0),
      since: sinceDate.toISOString(),
    });
  }
);
