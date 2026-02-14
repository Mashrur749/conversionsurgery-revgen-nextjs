import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { publishTemplate } from '@/lib/services/flow-templates';
import { z } from 'zod';

const publishSchema = z.object({
  changeNotes: z.string().optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = publishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const newVersion = await publishTemplate(
      id,
      parsed.data.changeNotes,
      session?.user?.id
    );

    return NextResponse.json({ success: true, version: newVersion });
  } catch (error) {
    console.error('[FlowTemplates] Publish error:', error);
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
