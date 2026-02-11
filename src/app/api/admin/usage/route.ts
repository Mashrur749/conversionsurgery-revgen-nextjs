import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, apiUsageMonthly, clients } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
    .optional(),
});

/** GET - Get usage summary for all clients */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      month: searchParams.get('month') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const month = parsed.data.month || getCurrentMonth();
    const db = getDb();

    // Get all clients with their monthly usage
    const usage = await db
      .select({
        clientId: apiUsageMonthly.clientId,
        clientName: clients.businessName,
        month: apiUsageMonthly.month,
        openaiCost: apiUsageMonthly.openaiCostCents,
        twilioSmsCost: apiUsageMonthly.twilioSmsCostCents,
        twilioVoiceCost: apiUsageMonthly.twilioVoiceCostCents,
        totalCost: apiUsageMonthly.totalCostCents,
        totalMessages: apiUsageMonthly.totalMessages,
        totalAiCalls: apiUsageMonthly.totalAiCalls,
        costChange: apiUsageMonthly.costChangePercent,
      })
      .from(apiUsageMonthly)
      .innerJoin(clients, eq(apiUsageMonthly.clientId, clients.id))
      .where(eq(apiUsageMonthly.month, month))
      .orderBy(desc(apiUsageMonthly.totalCostCents));

    // Calculate totals
    const totals = usage.reduce(
      (acc, u) => ({
        totalCost: acc.totalCost + u.totalCost,
        openaiCost: acc.openaiCost + u.openaiCost,
        twilioSmsCost: acc.twilioSmsCost + u.twilioSmsCost,
        totalMessages: acc.totalMessages + u.totalMessages,
        totalAiCalls: acc.totalAiCalls + u.totalAiCalls,
      }),
      { totalCost: 0, openaiCost: 0, twilioSmsCost: 0, totalMessages: 0, totalAiCalls: 0 }
    );

    return NextResponse.json({
      month,
      clients: usage,
      totals,
    });
  } catch (error) {
    console.error('[UsageTracking] GET /api/admin/usage failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
