import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { configureAgencyWebhooks } from '@/lib/services/twilio-provisioning';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

const AGENCY_NUMBER_KEY = 'agency_twilio_number';
const AGENCY_NUMBER_SID_KEY = 'agency_twilio_number_sid';

export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const db = getDb();
  const settings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, AGENCY_NUMBER_KEY));

  const sidSettings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, AGENCY_NUMBER_SID_KEY));

  return NextResponse.json({
    agencyNumber: settings[0]?.value ?? null,
    agencyNumberSid: sidSettings[0]?.value ?? null,
  });
}

const updateSchema = z.object({
  agencyNumber: z.string().min(10),
  agencyNumberSid: z.string().min(1),
  configureWebhooks: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const db = getDb();

    // Upsert agency number
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, AGENCY_NUMBER_KEY))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({ value: data.agencyNumber, updatedAt: new Date() })
        .where(eq(systemSettings.key, AGENCY_NUMBER_KEY));
    } else {
      await db.insert(systemSettings).values({
        key: AGENCY_NUMBER_KEY,
        value: data.agencyNumber,
        description: 'Agency Twilio number for client communication',
      });
    }

    // Upsert agency number SID
    const existingSid = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, AGENCY_NUMBER_SID_KEY))
      .limit(1);

    if (existingSid.length > 0) {
      await db
        .update(systemSettings)
        .set({ value: data.agencyNumberSid, updatedAt: new Date() })
        .where(eq(systemSettings.key, AGENCY_NUMBER_SID_KEY));
    } else {
      await db.insert(systemSettings).values({
        key: AGENCY_NUMBER_SID_KEY,
        value: data.agencyNumberSid,
        description: 'Agency Twilio number SID for webhook configuration',
      });
    }

    // Optionally configure webhooks on the agency number
    if (data.configureWebhooks) {
      await configureAgencyWebhooks(data.agencyNumberSid);
    }

    return NextResponse.json({
      success: true,
      agencyNumber: data.agencyNumber,
      agencyNumberSid: data.agencyNumberSid,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Agency Settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update agency settings' },
      { status: 500 }
    );
  }
}
