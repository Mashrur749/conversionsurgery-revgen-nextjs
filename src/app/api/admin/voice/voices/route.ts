import { NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { listVoices } from '@/lib/services/elevenlabs';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.AI_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const voices = await listVoices();
    return NextResponse.json(voices);
  } catch (error) {
    console.error('[ElevenLabs] Failed to list voices:', error);
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 });
  }
}
