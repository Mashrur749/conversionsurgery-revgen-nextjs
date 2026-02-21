import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getNumbers, addNumber } from '@/lib/services/client-phone-management';
import { z } from 'zod';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const numbers = await getNumbers(clientId);
    return NextResponse.json(numbers);
  }
);

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

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const parsed = addSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const record = await addNumber(clientId, parsed.data.phoneNumber, {
      friendlyName: parsed.data.friendlyName,
      isPrimary: parsed.data.isPrimary,
      capabilities: parsed.data.capabilities,
    });

    return NextResponse.json(record, { status: 201 });
  }
);
