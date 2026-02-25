import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { releaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const releaseSchema = z.object({
  clientId: z.string().uuid('Client ID must be a valid UUID'),
});

/**
 * POST /api/admin/twilio/release
 *
 * Release a phone number from a client. Clears Twilio webhooks and removes
 * the assignment from the database.
 * Requires PHONES_MANAGE permission.
 */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE },
  async ({ request }) => {
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
      logSanitizedConsoleError('[Twilio][release.post.failed]', new Error(result.error), {
        clientId,
      });
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio] Release success: client ${clientId}`);
    return NextResponse.json({ success: true });
  }
);
