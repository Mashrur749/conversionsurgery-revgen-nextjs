import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { DncService } from '@/lib/compliance/dnc-service';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { getDb } from '@/db';
import { doNotContactList } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();

    const entries = await db
      .select({
        id: doNotContactList.id,
        phoneNumber: doNotContactList.phoneNumber,
        source: doNotContactList.source,
        sourceReference: doNotContactList.sourceReference,
        createdAt: doNotContactList.addedAt,
      })
      .from(doNotContactList)
      .where(
        and(
          eq(doNotContactList.clientId, clientId),
          eq(doNotContactList.isActive, true)
        )
      )
      .orderBy(doNotContactList.addedAt);

    return NextResponse.json({ entries });
  }
);

const addSchema = z
  .object({
    phoneNumber: z.string().min(1),
    reason: z.string().optional(),
  })
  .strict();

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = addSchema.parse(body);

    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
    await DncService.addToDnc(
      normalizedPhone,
      'operator_exclusion',
      clientId,
      data.reason
    );

    return NextResponse.json({ success: true });
  }
);

const removeSchema = z
  .object({
    phoneNumber: z.string().min(1),
    reason: z.string().optional(),
  })
  .strict();

export const DELETE = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = removeSchema.parse(body);

    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
    await DncService.removeFromDnc(normalizedPhone, clientId, data.reason);

    return NextResponse.json({ success: true });
  }
);
