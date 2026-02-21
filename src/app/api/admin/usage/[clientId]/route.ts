import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getClientUsageSummary, getCurrentMonthUsage } from '@/lib/services/usage-tracking';
import { getUnacknowledgedAlerts } from '@/lib/services/usage-alerts';
import { z } from 'zod';

const querySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
    .optional(),
});

/** GET - Get detailed usage for a specific client */
export const GET = adminClientRoute<{ clientId: string }>(
  { permission: AGENCY_PERMISSIONS.BILLING_VIEW, clientIdFrom: (p) => p.clientId },
  async ({ request, clientId }) => {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const startDate = parsed.data.startDate || getMonthStart();
    const endDate = parsed.data.endDate || getToday();

    const [summary, currentMonth, alerts] = await Promise.all([
      getClientUsageSummary(clientId, startDate, endDate),
      getCurrentMonthUsage(clientId),
      getUnacknowledgedAlerts(clientId),
    ]);

    return NextResponse.json({
      ...summary,
      currentMonth,
      alerts,
    });
  }
);

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
