import { getDb } from '@/db';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { templateVariants, templatePerformanceMetrics } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/templates/performance
 * Retrieves aggregate performance metrics for all template variants
 */
export async function GET(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);

    const db = getDb();
    const url = new URL(req.url);
    const dateRange = url.searchParams.get('dateRange') || 'last_30_days';
    const templateType = url.searchParams.get('templateType');

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    if (dateRange === 'last_7_days') startDate.setDate(now.getDate() - 7);
    else if (dateRange === 'last_30_days') startDate.setDate(now.getDate() - 30);
    else if (dateRange === 'last_90_days') startDate.setDate(now.getDate() - 90);

    // Get template variants with their latest performance metrics
    const query = db
      .select({
        variant: templateVariants,
        latestMetrics: templatePerformanceMetrics,
        clientsUsing: sql<number>`(
          SELECT COUNT(DISTINCT client_id)
          FROM message_templates
          WHERE template_variant_id = ${templateVariants.id}
        )`,
      })
      .from(templateVariants)
      .leftJoin(
        templatePerformanceMetrics,
        eq(templateVariants.id, templatePerformanceMetrics.templateVariantId)
      )
      .where(
        templateType
          ? eq(templateVariants.templateType, templateType)
          : undefined
      )
      .orderBy(
        desc(templateVariants.templateType),
        desc(templateVariants.name)
      );

    const results = await query;

    // Group by variant and get most recent metrics per variant
    const variantMap = new Map<string, any>();
    results.forEach((row) => {
      const variantId = row.variant.id;
      if (!variantMap.has(variantId)) {
        variantMap.set(variantId, {
          id: row.variant.id,
          name: row.variant.name,
          templateType: row.variant.templateType,
          content: row.variant.content,
          isActive: row.variant.isActive,
          notes: row.variant.notes,
          clientsUsing: row.clientsUsing || 0,
          metrics: row.latestMetrics
            ? {
                executionsLast30Days: row.latestMetrics.totalExecutions,
                deliveryRate: Number(row.latestMetrics.deliveryRate),
                engagementRate: Number(row.latestMetrics.engagementRate),
                conversionRate: Number(row.latestMetrics.conversionRate),
                responseTime: row.latestMetrics.avgResponseTime,
              }
            : null,
        });
      }
    });

    const templateVariantsList = Array.from(variantMap.values());

    // Calculate comparisons within template types
    const grouped: Record<string, any[]> = {};
    templateVariantsList.forEach((variant) => {
      if (!grouped[variant.templateType]) {
        grouped[variant.templateType] = [];
      }
      grouped[variant.templateType].push(variant);
    });

    // Add comparison data
    const withComparisons = templateVariantsList.map((variant) => {
      const typeLiterals = grouped[variant.templateType];
      const others = typeLiterals.filter((v) => v.id !== variant.id);
      let comparison = null;

      if (others.length > 0 && variant.metrics) {
        const bestOther = others.reduce((best, current) => {
          const bestConv = Number(best.metrics?.conversionRate) || 0;
          const currentConv = Number(current.metrics?.conversionRate) || 0;
          return currentConv > bestConv ? current : best;
        });

        const variantConv = Number(variant.metrics?.conversionRate) || 0;
        const bestConv = Number(bestOther.metrics?.conversionRate) || 0;
        const improvement = bestConv > 0 ? ((variantConv - bestConv) / bestConv) * 100 : 0;

        comparison = {
          winnerVs: bestOther.name,
          improvementPercent: Number(improvement.toFixed(2)),
          recommendation:
            improvement > 0
              ? `CURRENT WINNER - ${Math.abs(improvement).toFixed(1)}% better than ${bestOther.name}`
              : `${Math.abs(improvement).toFixed(1)}% worse than ${bestOther.name}`,
        };
      }

      return {
        ...variant,
        comparison,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        templateVariants: withComparisons,
        dateRange,
        generatedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (error.message.includes('Forbidden')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }
    console.error('[ABTesting] GET /api/admin/templates/performance error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
