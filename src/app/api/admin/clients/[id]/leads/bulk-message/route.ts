import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { leads, clients } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';

const bulkMessageSchema = z.object({
  message: z.string().min(1).max(1600),
  filter: z
    .object({
      status: z.array(z.string()).optional(),
      source: z.string().optional(),
    })
    .optional(),
});

const BULK_MESSAGE_CAP = 50;

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const validated = bulkMessageSchema.parse(body);

    const db = getDb();

    // Look up the client's Twilio number
    const [client] = await db
      .select({ twilioNumber: clients.twilioNumber })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client?.twilioNumber) {
      return NextResponse.json(
        { error: 'Client has no Twilio number configured' },
        { status: 400 }
      );
    }

    // Build WHERE conditions
    const conditions = [
      eq(leads.clientId, clientId),
      eq(leads.optedOut, false),
    ];

    if (validated.filter?.status && validated.filter.status.length > 0) {
      conditions.push(inArray(leads.status, validated.filter.status));
    }

    if (validated.filter?.source) {
      conditions.push(eq(leads.source, validated.filter.source));
    }

    const matchedLeads = await db
      .select({ id: leads.id, phone: leads.phone })
      .from(leads)
      .where(and(...conditions));

    if (matchedLeads.length > BULK_MESSAGE_CAP) {
      return NextResponse.json(
        {
          error: `Too many leads matched (${matchedLeads.length}). Narrow your filter to ${BULK_MESSAGE_CAP} or fewer leads.`,
        },
        { status: 400 }
      );
    }

    let sent = 0;
    let blocked = 0;

    for (const lead of matchedLeads) {
      const result = await sendCompliantMessage({
        clientId,
        to: lead.phone,
        from: client.twilioNumber,
        body: validated.message,
        messageClassification: 'proactive_outreach',
        consentBasis: { type: 'existing_consent' },
        leadId: lead.id,
      });

      if (result.blocked) {
        blocked++;
      } else {
        sent++;
      }
    }

    return NextResponse.json({
      sent,
      blocked,
      total: matchedLeads.length,
    });
  }
);
