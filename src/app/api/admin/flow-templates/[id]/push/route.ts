import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { pushTemplateUpdate } from '@/lib/services/flow-templates';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/flow-templates/[id]/push
 * Push template updates to all client flows
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.FLOWS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    console.log('[FlowEngine] Pushing template update:', id, 'dryRun:', dryRun);
    const result = await pushTemplateUpdate(id, { dryRun });

    console.log('[FlowEngine] Push complete:', result.affected, 'affected,', result.skipped, 'skipped');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[FlowEngine] Template push error:', error);
    return NextResponse.json(
      { error: 'Failed to push template update' },
      { status: 500 }
    );
  }
}
