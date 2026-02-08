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

  // Validate area code format
  if (areaCode && !/^\d{3}$/.test(areaCode)) {
    return NextResponse.json(
      { error: 'Area code must be exactly 3 digits' },
      { status: 400 }
    );
  }

  try {
    console.log(`[Twilio Search] Searching for numbers in ${areaCode} (${country})`);

    const numbers = await searchAvailableNumbers({
      areaCode: areaCode,
      contains: contains,
      country: country,
    });

    console.log(`[Twilio Search] Found ${numbers.length} numbers`);

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
      isDevelopmentMock: process.env.NODE_ENV === 'development' && numbers.length > 0,
    });
  } catch (error: any) {
    console.error('[Twilio Search] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search available numbers' },
      { status: 500 }
    );
  }
}
