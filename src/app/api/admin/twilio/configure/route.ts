import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { configureExistingNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const schema = z.object({
  phoneNumber: z.string().min(10),
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { phoneNumber, clientId } = schema.parse(body);

    const result = await configureExistingNumber(phoneNumber, clientId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to configure' },
      { status: 500 }
    );
  }
}
