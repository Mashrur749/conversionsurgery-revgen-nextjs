import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getOnboardingChecklist } from '@/lib/services/onboarding-checklist';
import { NextResponse } from 'next/server';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const result = await getOnboardingChecklist(clientId);
    return NextResponse.json(result);
  }
);
