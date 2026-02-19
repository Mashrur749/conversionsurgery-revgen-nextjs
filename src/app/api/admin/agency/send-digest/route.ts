import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
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
export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const body = await request.json();
    const data = sendDigestSchema.parse(body);

    if (data.clientId) {
      await sendWeeklyDigest(data.clientId);
      return NextResponse.json({ success: true, sent: 1 });
    }

    const sent = await processAgencyWeeklyDigests();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Admin] Send digest error:', error);
    return NextResponse.json(
      { error: 'Failed to send digest' },
      { status: 500 }
    );
  }
}
