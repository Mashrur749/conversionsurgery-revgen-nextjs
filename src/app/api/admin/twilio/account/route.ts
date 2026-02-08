import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [balance, numbers] = await Promise.all([
    getAccountBalance(),
    listOwnedNumbers(),
  ]);

  return NextResponse.json({
    balance,
    numbers,
  });
}
