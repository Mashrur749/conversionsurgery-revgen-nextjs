import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { configureExistingNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const configureSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
  clientId: z.string().uuid('Client ID must be a valid UUID'),
});

/**
 * POST /api/admin/twilio/configure
 *
 * Configure an existing Twilio phone number for a client by updating its
 * webhook URLs and assigning it in the database.
 * Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = configureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, clientId } = parsed.data;

    console.log(`[Twilio] Configure request: number=${phoneNumber}, client=${clientId}`);

    const result = await configureExistingNumber(phoneNumber, clientId);

    if (!result.success) {
      console.error(`[Twilio] Configure failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio] Configure success: ${phoneNumber} -> client ${clientId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Configure API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to configure number' },
      { status: 500 }
    );
  }
}
