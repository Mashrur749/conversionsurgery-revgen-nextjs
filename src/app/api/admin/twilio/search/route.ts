import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { searchAvailableNumbers } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const searchQuerySchema = z.object({
  areaCode: z
    .string()
    .regex(/^\d{3}$/, 'Area code must be exactly 3 digits')
    .optional(),
  contains: z.string().optional(),
  country: z.string().length(2).default('CA'),
  inRegion: z.string().max(10).optional(),
  inLocality: z.string().max(100).optional(),
});

/**
 * GET /api/admin/twilio/search
 *
 * Search for available Twilio phone numbers by location (region/city) or
 * area code. Requires PHONES_MANAGE permission.
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE },
  async ({ request }) => {
    const url = new URL(request.url);
    const rawParams = {
      areaCode: url.searchParams.get('areaCode') || undefined,
      contains: url.searchParams.get('contains') || undefined,
      country: url.searchParams.get('country') || undefined,
      inRegion: url.searchParams.get('inRegion') || undefined,
      inLocality: url.searchParams.get('inLocality') || undefined,
    };

    const parsed = searchQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { areaCode, contains, country, inRegion, inLocality } = parsed.data;

    console.log(`[Twilio] Search request: region=${inRegion ?? 'any'}, locality=${inLocality ?? 'any'}, areaCode=${areaCode ?? 'any'}, country=${country}`);

    const numbers = await searchAvailableNumbers({
      areaCode,
      contains,
      country,
      inRegion,
      inLocality,
    });

    console.log(`[Twilio] Search returned ${numbers.length} numbers`);

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
      isDevelopmentMock: process.env.NODE_ENV === 'development' && numbers.length > 0,
    });
  }
);
