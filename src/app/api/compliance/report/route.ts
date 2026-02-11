import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceReportGenerator } from '@/lib/compliance/report-generator';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

const reportQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(1),
});

/** GET /api/compliance/report - Generate a compliance report for the authenticated client */
export async function GET(req: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = reportQuerySchema.safeParse({
      months: searchParams.get('months') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { months } = parsed.data;
    const endDate = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(new Date(), months - 1));

    const report = await ComplianceReportGenerator.generateReport(
      session.clientId,
      startDate,
      endDate
    );

    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Compliance Report] Failed to generate report:', message);
    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    );
  }
}
