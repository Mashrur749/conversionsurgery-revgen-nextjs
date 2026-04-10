import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clientMemberships, clients, people } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { normalizePhoneNumber } from '@/lib/utils/phone';

const sendTeamMessageSchema = z.object({
  message: z.string().min(1).max(1600),
}).strict();

export const POST = adminClientRoute<{ id: string; mid: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId }) => {
    const { mid: membershipId } = params;

    const body = await request.json();
    const validated = sendTeamMessageSchema.parse(body);

    const db = getDb();

    // Look up the team member's phone via clientMemberships JOIN people
    const [member] = await db
      .select({
        phone: people.phone,
        name: people.name,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(
        and(
          eq(clientMemberships.id, membershipId),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (!member || !member.phone) {
      return NextResponse.json(
        { error: 'Team member not found or has no phone number on file' },
        { status: 404 }
      );
    }

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

    const normalizedPhone = normalizePhoneNumber(member.phone);

    await sendCompliantMessage({
      clientId,
      to: normalizedPhone,
      from: client.twilioNumber,
      body: validated.message,
      messageClassification: 'proactive_outreach',
      consentBasis: { type: 'existing_customer' },
    });

    return NextResponse.json({ sent: true });
  }
);
