import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { z } from 'zod';
import {
  sendWeeklyDigest,
  processAgencyWeeklyDigests,
} from '@/lib/services/agency-communication';

const sendDigestSchema = z.object({
  clientId: z.string().uuid().optional(),
});

/**
 * Admin trigger to manually send agency digest.
 * POST { clientId } — send to one client
 * POST {} — send to all active clients
 */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ request }) => {
    const body = await request.json();
    const data = sendDigestSchema.parse(body);

    if (data.clientId) {
      await sendWeeklyDigest(data.clientId);
      return NextResponse.json({ success: true, sent: 1 });
    }

    const sent = await processAgencyWeeklyDigests();
    return NextResponse.json({ success: true, sent });
  }
);
