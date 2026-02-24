import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getQuietHoursPolicyDiagnostics } from '@/lib/compliance/quiet-hours-policy';

/** GET - Returns active quiet-hours policy mode and any client overrides. */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async () => {
    const diagnostics = await getQuietHoursPolicyDiagnostics();
    return NextResponse.json(diagnostics);
  }
);

