import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getNumbers, addNumber } from '@/lib/services/client-phone-management';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }
  const numbers = await getNumbers(id);
  return NextResponse.json(numbers);
}

const addSchema = z.object({
  phoneNumber: z.string().min(1).max(20),
  friendlyName: z.string().max(100).optional(),
  isPrimary: z.boolean().optional(),
  capabilities: z.object({
    sms: z.boolean(),
    voice: z.boolean(),
    mms: z.boolean(),
  }).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const parsed = addSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await addNumber(id, parsed.data.phoneNumber, {
    friendlyName: parsed.data.friendlyName,
    isPrimary: parsed.data.isPrimary,
    capabilities: parsed.data.capabilities,
  });

  return NextResponse.json(record, { status: 201 });
}
