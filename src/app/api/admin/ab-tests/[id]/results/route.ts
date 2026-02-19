import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { abTests, abTestMetrics } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/admin/ab-tests/[id]/results
 * Retrieves aggregated performance metrics for both variants of an A/B test
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ABTESTS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return Response.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const { id } = await params;
    const db = getDb();

    // Get test
    const [test] = await db
      .select()
      .from(abTests)
      .where(eq(abTests.id, id))
      .limit(1);

    if (!test) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    // Get metrics for both variants
    const allMetrics = await db
      .select()
      .from(abTestMetrics)
      .where(eq(abTestMetrics.testId, id));

    // Aggregate metrics by variant
    const variantAMetrics = allMetrics.filter((m) => m.variant === 'A');
    const variantBMetrics = allMetrics.filter((m) => m.variant === 'B');

    const aggregateMetrics = (metrics: typeof abTestMetrics.$inferSelect[]) => ({
      messagesSent: metrics.reduce((sum, m) => sum + (m.messagesSent || 0), 0),
      messagesDelivered: metrics.reduce(
        (sum, m) => sum + (m.messagesDelivered || 0),
        0
      ),
      conversationsStarted: metrics.reduce(
        (sum, m) => sum + (m.conversationsStarted || 0),
        0
      ),
      appointmentsBooked: metrics.reduce(
        (sum, m) => sum + (m.appointmentsBooked || 0),
        0
      ),
      formsResponded: metrics.reduce((sum, m) => sum + (m.formsResponded || 0), 0),
      leadsQualified: metrics.reduce((sum, m) => sum + (m.leadsQualified || 0), 0),
      estimatesFollowedUp: metrics.reduce(
        (sum, m) => sum + (m.estimatesFollowedUp || 0),
        0
      ),
      conversionsCompleted: metrics.reduce(
        (sum, m) => sum + (m.conversionsCompleted || 0),
        0
      ),
    });

    const variantAAggregate = aggregateMetrics(variantAMetrics);
    const variantBAggregate = aggregateMetrics(variantBMetrics);

    // Calculate metrics and performance
    const getMetrics = (agg: typeof variantAAggregate) => {
      const deliveryRate =
        agg.messagesSent > 0
          ? ((agg.messagesDelivered / agg.messagesSent) * 100).toFixed(1)
          : '0';
      const engagementRate =
        agg.messagesSent > 0
          ? ((agg.conversationsStarted / agg.messagesSent) * 100).toFixed(1)
          : '0';
      const conversionRate =
        agg.conversationsStarted > 0
          ? (
              (agg.conversionsCompleted / agg.conversationsStarted) *
              100
            ).toFixed(1)
          : '0';
      const appointmentRate =
        agg.conversationsStarted > 0
          ? ((agg.appointmentsBooked / agg.conversationsStarted) * 100).toFixed(1)
          : '0';

      return {
        ...agg,
        deliveryRate: parseFloat(deliveryRate),
        engagementRate: parseFloat(engagementRate),
        conversionRate: parseFloat(conversionRate),
        appointmentRate: parseFloat(appointmentRate),
      };
    };

    const metricsA = getMetrics(variantAAggregate);
    const metricsB = getMetrics(variantBAggregate);

    // Determine winner (if not set, calculate based on conversion rate)
    let performanceWinner = test.winner;
    if (!performanceWinner) {
      performanceWinner =
        metricsB.conversionRate > metricsA.conversionRate ? 'B' : 'A';
    }

    return Response.json({
      success: true,
      test,
      variants: {
        A: metricsA,
        B: metricsB,
      },
      dailyMetrics: {
        A: variantAMetrics,
        B: variantBMetrics,
      },
      performance: {
        winner: performanceWinner,
        improvement:
          metricsB.conversionRate > metricsA.conversionRate
            ? (
                ((metricsB.conversionRate - metricsA.conversionRate) /
                  metricsA.conversionRate) *
                100
              ).toFixed(1)
            : (
                ((metricsA.conversionRate - metricsB.conversionRate) /
                  metricsB.conversionRate) *
                100
              ).toFixed(1),
      },
    });
  } catch (error) {
    console.error('[ABTesting] GET /api/admin/ab-tests/[id]/results error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch test results' },
      { status: 500 }
    );
  }
}
