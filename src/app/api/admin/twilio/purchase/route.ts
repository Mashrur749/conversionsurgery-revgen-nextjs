import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { purchaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const purchaseSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
  clientId: z.string().uuid('Client ID must be a valid UUID'),
});

/**
 * POST /api/admin/twilio/purchase
 *
 * Purchase a phone number from Twilio and assign it to a client.
 * Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, clientId } = parsed.data;

    console.log(`[Twilio] Purchase request: number=${phoneNumber}, client=${clientId}`);

    const result = await purchaseNumber(phoneNumber, clientId);

    if (!result.success) {
      console.error(`[Twilio] Purchase failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio] Purchase success: SID=${result.sid}`);
    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Purchase API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to purchase number' },
      { status: 500 }
    );
  }
}
