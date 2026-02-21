import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { listVoices } from '@/lib/services/elevenlabs';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.AI_EDIT },
  async () => {
    const voices = await listVoices();
    return NextResponse.json(voices);
  }
);
