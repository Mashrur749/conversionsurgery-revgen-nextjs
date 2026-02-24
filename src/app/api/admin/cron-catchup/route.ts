import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  getCronCatchupStatusSnapshot,
  runCronCatchupJobByKey,
  type CronCatchupJobKey,
} from '@/lib/services/cron-catchup-jobs';

/** GET /api/admin/cron-catchup - Catch-up status across periodic managed-service jobs. */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async () => {
    const snapshot = await getCronCatchupStatusSnapshot();
    return NextResponse.json({ success: true, snapshot });
  }
);

const runSchema = z.object({
  jobKey: z.enum(['monthly_reset', 'biweekly_reports']),
  maxPeriodsPerRun: z.number().int().min(1).max(12).optional(),
}).strict();

/** POST /api/admin/cron-catchup - Manually execute catch-up for one periodic job. */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async ({ request }) => {
    const payload = await request.json();
    const parsed = runSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await runCronCatchupJobByKey(parsed.data.jobKey as CronCatchupJobKey, {
      maxPeriodsPerRun: parsed.data.maxPeriodsPerRun,
    });
    const snapshot = await getCronCatchupStatusSnapshot();

    return NextResponse.json({ success: true, result, snapshot });
  }
);
