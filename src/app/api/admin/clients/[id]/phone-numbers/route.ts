import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getNumbers, addNumber } from '@/lib/services/client-phone-management';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
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
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
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
