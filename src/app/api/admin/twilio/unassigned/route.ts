import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listUnassignedNumbers } from '@/lib/services/twilio-provisioning';

/**
 * GET /api/admin/twilio/unassigned
 *
 * List Twilio phone numbers on the account that are not assigned to any client.
 * Requires admin authentication.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const numbers = await listUnassignedNumbers();

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Unassigned numbers API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to list unassigned numbers' },
      { status: 500 }
    );
  }
}
