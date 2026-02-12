import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { releaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const releaseSchema = z.object({
  clientId: z.string().uuid('Client ID must be a valid UUID'),
});

/**
 * POST /api/admin/twilio/release
 *
 * Release a phone number from a client. Clears Twilio webhooks and removes
 * the assignment from the database.
 * Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = releaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;

    console.log(`[Twilio] Release request: client=${clientId}`);

    const result = await releaseNumber(clientId);

    if (!result.success) {
      console.error(`[Twilio] Release failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio] Release success: client ${clientId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Release API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to release number' },
      { status: 500 }
    );
  }
}
