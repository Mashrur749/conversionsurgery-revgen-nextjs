import { NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { listVoices } from '@/lib/services/elevenlabs';

export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.AI_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const voices = await listVoices();
    return NextResponse.json(voices);
  } catch (error) {
    console.error('[ElevenLabs] Failed to list voices:', error);
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 });
  }
}
