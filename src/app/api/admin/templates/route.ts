import { getDb } from '@/db';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { templateVariants } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/templates
 * Retrieves all template variants with client usage counts
 */
export async function GET(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.TEMPLATES_EDIT);

    const db = getDb();
    const url = new URL(req.url);
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (error.message.includes('Forbidden')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }
    console.error('[ABTesting] GET /api/admin/templates error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
