import { z } from 'zod';
import { getDb } from '@/db';
import { clientPhoneNumbers } from '@/db/schema';
import { eq, count as countFn } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { purchaseNumber } from '@/lib/services/twilio-provisioning';
import { checkUsageLimit, getSubscriptionWithPlan } from '@/lib/services/subscription';
import { recordPhoneNumberAddonEventForPurchase } from '@/lib/services/addon-billing-ledger';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import {
  ADDON_PRICING_KEYS,
  formatAddonPrice,
  getAddonPricing,
} from '@/lib/services/addon-pricing';

const purchaseSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
}).strict();

/** POST /api/client/phone-numbers/purchase — Purchase and assign a Twilio number */
export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ session, request }) => {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber } = parsed.data;
    const clientId = session.clientId;

    // Require active subscription before purchasing a number
    const subscription = await getSubscriptionWithPlan(clientId);
    if (!subscription) {
      return Response.json(
        { error: 'Please choose a plan before setting up your phone number.', requiresSubscription: true },
        { status: 402 }
      );
    }

    // Check phone number usage limit
    const db = getDb();
    const phoneCount = await db
      .select({ count: countFn() })
      .from(clientPhoneNumbers)
      .where(eq(clientPhoneNumbers.clientId, clientId));
    const currentPhoneCount = (phoneCount[0]?.count ?? 0) + 1;

    const usageCheck = await checkUsageLimit(clientId, 'phone_numbers', currentPhoneCount);
    if (!usageCheck.allowed) {
      const addonPricing = await getAddonPricing(clientId);
      const numberPrice = addonPricing[ADDON_PRICING_KEYS.EXTRA_NUMBER].unitPriceCents;
      return Response.json(
        {
          error: `Phone number limit reached (${usageCheck.current}/${usageCheck.limit}). Additional numbers are ${formatAddonPrice(numberPrice)}/month each.`,
        },
        { status: 403 }
      );
    }

    const result = await purchaseNumber(phoneNumber, clientId);

    if (!result.success) {
      logSanitizedConsoleError('[Twilio][client-purchase.failed]', new Error(result.error), {
        clientId,
        phoneNumber,
      });
      return Response.json({ error: result.error }, { status: 400 });
    }

    // Record add-on billing event (fire-and-forget)
    recordPhoneNumberAddonEventForPurchase(clientId, phoneNumber).catch((error) => {
      logSanitizedConsoleError('[Twilio][client-purchase.record-addon]', error, {
        clientId,
        phoneNumber,
      });
    });

    return Response.json({ success: true });
  }
);
