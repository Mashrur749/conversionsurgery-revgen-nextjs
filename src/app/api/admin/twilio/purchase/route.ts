import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { purchaseNumber } from '@/lib/services/twilio-provisioning';
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

    console.log(`[Twilio Purchase API] Purchasing number ${phoneNumber} for client ${clientId}`);

    const result = await purchaseNumber(phoneNumber, clientId);

    if (!result.success) {
      console.error(`[Twilio Purchase API] Purchase failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio Purchase API] Success! SID: ${result.sid}`);
    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error: any) {
    console.error('[Twilio Purchase API] Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to purchase number' },
      { status: 500 }
    );
  }
}
