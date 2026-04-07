import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { configureAgencyWebhooks } from '@/lib/services/twilio-provisioning';
import { getAgency } from '@/lib/services/agency-settings';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async () => {
    const agency = await getAgency();

    return NextResponse.json({
      agencyNumber: agency.twilioNumber ?? null,
      agencyNumberSid: agency.twilioNumberSid ?? null,
      operatorPhone: agency.operatorPhone ?? null,
      operatorName: agency.operatorName ?? null,
    });
  }
);

const updateSchema = z.object({
  agencyNumber: z.string().min(10),
  agencyNumberSid: z.string().min(1),
  operatorPhone: z.string().optional(),
  operatorName: z.string().optional(),
  configureWebhooks: z.boolean().optional(),
});

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async ({ request }) => {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const db = getDb();
    const agency = await getAgency();

    await db
      .update(agencies)
      .set({
        twilioNumber: data.agencyNumber,
        twilioNumberSid: data.agencyNumberSid,
        operatorPhone: data.operatorPhone || agency.operatorPhone,
        operatorName: data.operatorName || agency.operatorName,
        updatedAt: new Date(),
      })
      .where(eq(agencies.id, agency.id));

    // Optionally configure webhooks on the agency number
    if (data.configureWebhooks) {
      await configureAgencyWebhooks(data.agencyNumberSid);
    }

    return NextResponse.json({
      success: true,
      agencyNumber: data.agencyNumber,
      agencyNumberSid: data.agencyNumberSid,
    });
  }
);
