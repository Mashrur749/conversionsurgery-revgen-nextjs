import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pushTemplateUpdate } from '@/lib/services/flow-templates';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/flow-templates/[id]/push
 * Push template updates to all client flows
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin;

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
