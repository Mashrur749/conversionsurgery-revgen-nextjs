import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { fullSync } from '@/lib/services/calendar';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** POST /api/client/calendar/sync - Trigger a full calendar sync for the portal client */
export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ session }) => {
    try {
      const results = await fullSync(session.clientId);
      return NextResponse.json(results);
    } catch (error) {
      return safeErrorResponse('[Calendar][portal.sync]', error, 'Sync failed');
    }
  }
);
