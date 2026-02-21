import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getRecentJobs, getRevenueStats, createJobFromLead } from '@/lib/services/revenue';
import { z } from 'zod';

const createJobSchema = z.object({
  leadId: z.string().uuid(),
  description: z.string().optional(),
});

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const [jobsList, stats] = await Promise.all([
      getRecentJobs(clientId, 20),
      getRevenueStats(clientId),
    ]);

    return NextResponse.json({ jobs: jobsList, stats });
  }
);

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = createJobSchema.parse(body);
    const jobId = await createJobFromLead(data.leadId, clientId, data.description);

    return NextResponse.json({ jobId });
  }
);
