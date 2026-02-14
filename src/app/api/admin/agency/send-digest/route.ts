import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
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
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
