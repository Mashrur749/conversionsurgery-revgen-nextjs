import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clients, people, clientMemberships, roleTemplates } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async ({ session }) => {
    const db = getDb();
    const baseQuery = db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt));

    const allClients =
      session.clientScope === 'assigned'
        ? (session.assignedClientIds?.length
            ? await baseQuery.where(inArray(clients.id, session.assignedClientIds))
            : [])
        : await baseQuery;

    return NextResponse.json({ clients: allClients });
  }
);

const createClientSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Phone number is required'),
  timezone: z.string().default('America/Edmonton'),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')),
});

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_CREATE },
  async ({ request }) => {
    const body = await request.json();
    const data = createClientSchema.parse(body);

    const db = getDb();
    const normalizedPhone = normalizePhoneNumber(data.phone);

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, data.email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 400 }
      );
    }

    const [ownerTemplate] = await db
      .select({ id: roleTemplates.id })
      .from(roleTemplates)
      .where(
        and(
          eq(roleTemplates.slug, 'business_owner'),
          eq(roleTemplates.scope, 'client')
        )
      )
      .limit(1);

    if (!ownerTemplate) {
      return NextResponse.json(
        { error: 'Business owner role template is missing. Run role template seeds.' },
        { status: 500 }
      );
    }

    const client = await db.transaction(async (tx) => {
      const [createdClient] = await tx
        .insert(clients)
        .values({
          businessName: data.businessName,
          ownerName: data.ownerName,
          email: data.email,
          phone: normalizedPhone,
          timezone: data.timezone,
          googleBusinessUrl: data.googleBusinessUrl || null,
          status: 'pending', // Not active until Twilio number assigned
        })
        .returning();

      let [person] = await tx
        .select()
        .from(people)
        .where(eq(people.email, data.email))
        .limit(1);

      if (!person) {
        [person] = await tx
          .insert(people)
          .values({
            name: data.ownerName,
            email: data.email,
            phone: normalizedPhone,
          })
          .returning();
      } else {
        await tx
          .update(people)
          .set({
            name: data.ownerName,
            phone: person.phone || normalizedPhone,
            updatedAt: new Date(),
          })
          .where(eq(people.id, person.id));
      }

      await tx
        .insert(clientMemberships)
        .values({
          personId: person.id,
          clientId: createdClient.id,
          roleTemplateId: ownerTemplate.id,
          isOwner: true,
          receiveEscalations: true,
          receiveHotTransfers: true,
        });

      return createdClient;
    });

    return NextResponse.json({ client });
  }
);
