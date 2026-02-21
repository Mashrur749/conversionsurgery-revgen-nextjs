import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { synthesizeSpeech } from '@/lib/services/elevenlabs';
import { z } from 'zod';

const previewSchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1).max(500),
}).strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.AI_EDIT },
  async ({ request }) => {
    const parsed = previewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const audio = await synthesizeSpeech(parsed.data.voiceId, parsed.data.text);
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline',
      },
    });
  }
);
