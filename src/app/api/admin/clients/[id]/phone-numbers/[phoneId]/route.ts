import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { removeNumber, setPrimary } from '@/lib/services/client-phone-management';
import { getDb } from '@/db';
import { clientPhoneNumbers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

/** Verify a phone number record belongs to the specified client */
async function verifyPhoneOwnership(phoneId: string, clientId: string) {
  const db = getDb();
  const [record] = await db
    .select({ id: clientPhoneNumbers.id })
    .from(clientPhoneNumbers)
    .where(and(eq(clientPhoneNumbers.id, phoneId), eq(clientPhoneNumbers.clientId, clientId)))
    .limit(1);
  return !!record;
}

const patchSchema = z.object({
  isPrimary: z.boolean().optional(),
}).strict();

export const PATCH = adminClientRoute<{ id: string; phoneId: string }>(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId }) => {
    const { phoneId } = params;

    if (!(await verifyPhoneOwnership(phoneId, clientId))) {
      return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.isPrimary) {
      await setPrimary(phoneId);
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = adminClientRoute<{ id: string; phoneId: string }>(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE, clientIdFrom: (p) => p.id },
  async ({ params, clientId }) => {
    const { phoneId } = params;

    if (!(await verifyPhoneOwnership(phoneId, clientId))) {
      return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
    }

    await removeNumber(phoneId);
    return NextResponse.json({ success: true });
  }
);
