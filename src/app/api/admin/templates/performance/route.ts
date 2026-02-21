import { getDb } from '@/db';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { templateVariants, templatePerformanceMetrics } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

interface VariantSummary {
  id: string;
  name: string;
  templateType: string;
  content: string;
  isActive: boolean | null;
  notes: string | null;
  clientsUsing: number;
  metrics: {
    executionsLast30Days: number | null;
    deliveryRate: number;
    engagementRate: number;
    conversionRate: number;
    responseTime: number | null;
  } | null;
}

/**
 * GET /api/admin/templates/performance
 * Retrieves aggregate performance metrics for all template variants
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const db = getDb();
    const url = new URL(request.url);
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
    const variantMap = new Map<string, VariantSummary>();
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
    const grouped: Record<string, VariantSummary[]> = {};
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
  }
);
