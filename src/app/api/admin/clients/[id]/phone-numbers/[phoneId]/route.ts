import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { removeNumber, setPrimary } from '@/lib/services/client-phone-management';
import { getDb } from '@/db';
import { clientPhoneNumbers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  const { id, phoneId } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  if (!(await verifyPhoneOwnership(phoneId, id))) {
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  const { id, phoneId } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  if (!(await verifyPhoneOwnership(phoneId, id))) {
    return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
  }

  await removeNumber(phoneId);
  return NextResponse.json({ success: true });
}
