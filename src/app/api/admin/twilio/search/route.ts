import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchAvailableNumbers } from '@/lib/services/twilio-provisioning';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const areaCode = url.searchParams.get('areaCode') || undefined;
  const contains = url.searchParams.get('contains') || undefined;
  const country = url.searchParams.get('country') || 'CA';

  try {
    const numbers = await searchAvailableNumbers({
      areaCode: areaCode,
      contains: contains,
      country: country,
    });

    return NextResponse.json({ numbers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to search' },
      { status: 500 }
    );
  }
}
