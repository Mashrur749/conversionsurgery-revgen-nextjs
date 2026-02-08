import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { releaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const schema = z.object({
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { clientId } = schema.parse(body);

    const result = await releaseNumber(clientId);

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
      { error: error.message || 'Failed to release' },
      { status: 500 }
    );
  }
}
