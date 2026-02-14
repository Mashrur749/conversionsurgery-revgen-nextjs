import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listVoices } from '@/lib/services/elevenlabs';

export async function GET() {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const voices = await listVoices();
    return NextResponse.json(voices);
  } catch (error) {
    console.error('[ElevenLabs] Failed to list voices:', error);
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 });
  }
}
