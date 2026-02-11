import { getDb } from '@/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { templateVariants } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/templates
 * Retrieves all template variants with client usage counts
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as { user?: { isAdmin?: boolean } })?.user?.isAdmin) {
      return new Response('Unauthorized', { status: 403 });
    }

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
