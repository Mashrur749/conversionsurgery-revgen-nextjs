import { z } from 'zod';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { searchAvailableNumbers } from '@/lib/services/twilio-provisioning';

const searchQuerySchema = z.object({
  areaCode: z.string().regex(/^\d{3}$/).optional(),
  country: z.string().length(2).default('CA'),
  inRegion: z.string().max(10).optional(),
  inLocality: z.string().max(100).optional(),
}).strict();

/** GET /api/client/phone-numbers/search — Search available Twilio numbers */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request }) => {
    const url = new URL(request.url);
    const rawParams = {
      areaCode: url.searchParams.get('areaCode') || undefined,
      country: url.searchParams.get('country') || undefined,
      inRegion: url.searchParams.get('inRegion') || undefined,
      inLocality: url.searchParams.get('inLocality') || undefined,
    };

    const parsed = searchQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const numbers = await searchAvailableNumbers(parsed.data);

    return Response.json({ numbers, count: numbers.length });
  }
);
