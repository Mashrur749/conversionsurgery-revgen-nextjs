import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { leads, scheduledMessages } from '@/db/schema';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Step 1: Get lead IDs that already have active estimate_followup sequences
    const activeFollowupRows = await db
      .selectDistinct({ leadId: scheduledMessages.leadId })
      .from(scheduledMessages)
      .where(
        and(
          eq(scheduledMessages.clientId, clientId),
          eq(scheduledMessages.sequenceType, 'estimate_followup'),
          eq(scheduledMessages.sent, false),
          eq(scheduledMessages.cancelled, false)
        )
      );
    const excludeLeadIds = new Set(activeFollowupRows.map((r) => r.leadId));

    // Step 2: Query leads needing follow-up
    const conditions = [
      eq(leads.clientId, clientId),
      inArray(leads.status, ['new', 'contacted']),
      lte(leads.createdAt, threeDaysAgo),
      eq(leads.optedOut, false),
    ];

    // Exclude leads with active sequences (if any exist)
    if (excludeLeadIds.size > 0) {
      const ids = Array.from(excludeLeadIds);
      conditions.push(
        sql`${leads.id} NOT IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    const result = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        status: leads.status,
        projectType: leads.projectType,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(...conditions))
      .orderBy(leads.createdAt)
      .limit(10);

    const now = Date.now();
    const leadsDto = result.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      projectType: lead.projectType,
      daysSinceCreated: Math.floor(
        (now - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return NextResponse.json({ leads: leadsDto });
  }
);
