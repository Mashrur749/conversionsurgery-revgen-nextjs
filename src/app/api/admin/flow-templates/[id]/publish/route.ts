import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { publishTemplate } from '@/lib/services/flow-templates';

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
    const body = (await request.json().catch(() => ({}))) as {
      changeNotes?: string;
    };
    const version = await publishTemplate(
      id,
      body.changeNotes,
      (session as any).user?.id
    );

    return NextResponse.json({ version });
  } catch (error) {
    console.error('[Flow Templates] Publish error:', error);
    return NextResponse.json(
      { error: 'Failed to publish template' },
      { status: 500 }
    );
  }
}
