import { getDb } from '@/db';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { templateVariants } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/templates
 * Retrieves all template variants with client usage counts
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ request }) => {
    const db = getDb();
    const url = new URL(request.url);
    const templateType = url.searchParams.get('templateType');

    // Get all active template variants with client count
    let whereCondition;
    if (templateType) {
      whereCondition = eq(templateVariants.templateType, templateType);
    }

    const results = await db
      .select({
        id: templateVariants.id,
        templateType: templateVariants.templateType,
        name: templateVariants.name,
        content: templateVariants.content,
        isActive: templateVariants.isActive,
        notes: templateVariants.notes,
        createdAt: templateVariants.createdAt,
        updatedAt: templateVariants.updatedAt,
        clientsUsing: sql<number>`(
          SELECT COUNT(DISTINCT client_id)
          FROM message_templates
          WHERE template_variant_id = ${templateVariants.id}
        )`,
      })
      .from(templateVariants)
      .where(whereCondition)
      .orderBy(desc(templateVariants.createdAt));

    return new Response(
      JSON.stringify({
        success: true,
        templates: results,
        count: results.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
);
