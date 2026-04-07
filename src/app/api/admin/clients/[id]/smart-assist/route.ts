import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { scheduledMessages, leads } from '@/db/schema';
import { SMART_ASSIST_STATUS, SMART_ASSIST_SEQUENCE_TYPE } from '@/lib/services/smart-assist-state';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();

    const rows = await db
      .select({
        id: scheduledMessages.id,
        leadId: scheduledMessages.leadId,
        leadName: leads.name,
        leadPhone: leads.phone,
        content: scheduledMessages.content,
        assistCategory: scheduledMessages.assistCategory,
        assistReferenceCode: scheduledMessages.assistReferenceCode,
        assistRequiresManual: scheduledMessages.assistRequiresManual,
        sendAt: scheduledMessages.sendAt,
        createdAt: scheduledMessages.createdAt,
      })
      .from(scheduledMessages)
      .innerJoin(leads, eq(scheduledMessages.leadId, leads.id))
      .where(
        and(
          eq(scheduledMessages.clientId, clientId),
          eq(scheduledMessages.sequenceType, SMART_ASSIST_SEQUENCE_TYPE),
          eq(scheduledMessages.assistStatus, SMART_ASSIST_STATUS.PENDING_APPROVAL),
          eq(scheduledMessages.sent, false),
          eq(scheduledMessages.cancelled, false)
        )
      )
      .orderBy(scheduledMessages.sendAt);

    const drafts = rows.map((row) => ({
      id: row.id,
      leadName: row.leadName ?? null,
      leadPhone: row.leadPhone,
      content: row.content,
      assistCategory: row.assistCategory,
      assistReferenceCode: row.assistReferenceCode,
      assistRequiresManual: row.assistRequiresManual ?? false,
      sendAt: row.sendAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ drafts });
  }
);
