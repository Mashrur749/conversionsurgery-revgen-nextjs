import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';

/**
 * GET /api/admin/twilio/account
 *
 * Retrieve Twilio account information including current balance and all
 * owned phone numbers.
 * Requires admin authentication.
 */
export async function GET(_request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const [balance, numbers] = await Promise.all([
      getAccountBalance(),
      listOwnedNumbers(),
    ]);

    return NextResponse.json({
      balance,
      numbers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Account API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to fetch account info' },
      { status: 500 }
    );
  }
}
