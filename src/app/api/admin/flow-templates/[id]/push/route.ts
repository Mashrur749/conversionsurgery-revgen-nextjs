import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pushTemplateUpdate } from '@/lib/services/flow-templates';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const result = await pushTemplateUpdate(id, { dryRun });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Flow Templates] Push error:', error);
    return NextResponse.json(
      { error: 'Failed to push template update' },
      { status: 500 }
    );
  }
}
