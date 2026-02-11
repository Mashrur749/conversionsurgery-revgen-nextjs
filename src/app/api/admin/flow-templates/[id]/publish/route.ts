import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { publishTemplate } from '@/lib/services/flow-templates';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/flow-templates/[id]/publish
 * Publish a template and create version snapshot
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  const isAdmin = (session as { user?: { isAdmin?: boolean; id?: string } })?.user?.isAdmin;

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      changeNotes?: string;
    };
    const userId = (session as { user?: { id?: string } })?.user?.id;
    const version = await publishTemplate(
      id,
      body.changeNotes,
      userId
    );

    console.log('[FlowEngine] Published template:', id, 'version:', version);
    return NextResponse.json({ version });
  } catch (error) {
    console.error('[FlowEngine] Template publish error:', error);
    return NextResponse.json(
      { error: 'Failed to publish template' },
      { status: 500 }
    );
  }
}
