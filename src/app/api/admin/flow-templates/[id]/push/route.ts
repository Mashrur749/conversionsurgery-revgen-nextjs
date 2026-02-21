import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { pushTemplateUpdate } from '@/lib/services/flow-templates';

/**
 * POST /api/admin/flow-templates/[id]/push
 * Push template updates to all client flows
 */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async ({ request, params }) => {
    const { id } = params;

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    console.log('[FlowEngine] Pushing template update:', id, 'dryRun:', dryRun);
    const result = await pushTemplateUpdate(id, { dryRun });

    console.log('[FlowEngine] Push complete:', result.affected, 'affected,', result.skipped, 'skipped');
    return NextResponse.json(result);
  }
);
