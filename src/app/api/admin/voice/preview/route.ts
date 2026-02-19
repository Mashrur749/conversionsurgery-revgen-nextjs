import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { synthesizeSpeech } from '@/lib/services/elevenlabs';
import { z } from 'zod';

const previewSchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1).max(500),
}).strict();

export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.AI_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const parsed = previewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const audio = await synthesizeSpeech(parsed.data.voiceId, parsed.data.text);
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    console.error('[ElevenLabs] Preview error:', error);
    return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
  }
}
