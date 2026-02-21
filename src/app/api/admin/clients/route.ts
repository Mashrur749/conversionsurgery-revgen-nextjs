import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const db = getDb();
    const allClients = await db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt));

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

    const [client] = await db
      .insert(clients)
      .values({
        businessName: data.businessName,
        ownerName: data.ownerName,
        email: data.email,
        phone: normalizePhoneNumber(data.phone),
        timezone: data.timezone,
        googleBusinessUrl: data.googleBusinessUrl || null,
        status: 'pending', // Not active until Twilio number assigned
      })
      .returning();

    return NextResponse.json({ client });
  }
);
