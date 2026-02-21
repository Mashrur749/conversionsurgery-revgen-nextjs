import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { publishTemplate } from '@/lib/services/flow-templates';
import { z } from 'zod';

const publishSchema = z.object({
  changeNotes: z.string().optional(),
}).strict();

export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async ({ request, session, params }) => {
    const { id } = params;

    const parsed = publishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const newVersion = await publishTemplate(
      id,
      parsed.data.changeNotes,
      session.userId
    );

    return NextResponse.json({ success: true, version: newVersion });
  }
);
