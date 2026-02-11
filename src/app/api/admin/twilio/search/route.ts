import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchAvailableNumbers } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const searchQuerySchema = z.object({
  areaCode: z
    .string()
    .regex(/^\d{3}$/, 'Area code must be exactly 3 digits')
    .optional(),
  contains: z.string().optional(),
  country: z.string().length(2).default('CA'),
});

/**
 * GET /api/admin/twilio/search
 *
 * Search for available Twilio phone numbers by area code and/or pattern.
 * Requires admin authentication.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawParams = {
    areaCode: url.searchParams.get('areaCode') || undefined,
    contains: url.searchParams.get('contains') || undefined,
    country: url.searchParams.get('country') || undefined,
  };

  const parsed = searchQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { areaCode, contains, country } = parsed.data;

  try {
    console.log(`[Twilio] Search request: areaCode=${areaCode ?? 'any'}, country=${country}`);

    const numbers = await searchAvailableNumbers({
      areaCode,
      contains,
      country,
    });

    console.log(`[Twilio] Search returned ${numbers.length} numbers`);

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
      isDevelopmentMock: process.env.NODE_ENV === 'development' && numbers.length > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Search API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to search available numbers' },
      { status: 500 }
    );
  }
}
