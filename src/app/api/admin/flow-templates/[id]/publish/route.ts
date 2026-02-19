import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { publishTemplate } from '@/lib/services/flow-templates';
import { z } from 'zod';

const publishSchema = z.object({
  changeNotes: z.string().optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let agencySession;
  try {
    agencySession = await requireAgencyPermission(AGENCY_PERMISSIONS.FLOWS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
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
      agencySession.userId
    );

    return NextResponse.json({ success: true, version: newVersion });
  } catch (error) {
    console.error('[FlowTemplates] Publish error:', error);
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
