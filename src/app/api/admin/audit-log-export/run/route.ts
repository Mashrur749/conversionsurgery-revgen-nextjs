/**
 * Admin manual trigger for the weekly R2 audit-log export.
 *
 * Used by the "Run export now" button on `/admin/system-health` so an
 * operator can validate the cron path during E2E rehearsal without waiting
 * for Sunday 3am UTC. Uses the same code path as the cron route — just
 * without the bearer-token gate (this endpoint is admin-permission gated).
 */
import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { runAuditLogExport } from '@/app/api/cron/audit-log-export/route';
import { safeErrorResponse } from '@/lib/utils/api-errors';

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async () => {
    try {
      const result = await runAuditLogExport();
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      return safeErrorResponse(
        '[Admin][audit-log-export][run]',
        error,
        'Audit log export failed',
      );
    }
  },
);
