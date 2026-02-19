import { getDb } from '@/db';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { messageTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const assignTemplateSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  templateVariantId: z.string().uuid('Invalid template variant ID'),
  templateType: z.string().min(1, 'Template type required'),
});

/**
 * POST /api/admin/templates/assign
 * Assigns a template variant to a client for a specific template type
 */
export async function POST(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.TEMPLATES_EDIT);

    const body = await req.json();
    const parsed = assignTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation error',
          details: parsed.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, templateVariantId, templateType } = parsed.data;

    const db = getDb();

    // Check if template exists for this client and type
    const existing = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.clientId, clientId),
          eq(messageTemplates.templateType, templateType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing template assignment
      await db
        .update(messageTemplates)
        .set({
          templateVariantId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messageTemplates.clientId, clientId),
            eq(messageTemplates.templateType, templateType)
          )
        );
    } else {
      // This shouldn't happen in normal flow, but handle it
      return new Response(
        JSON.stringify({
          success: false,
          error: `No message template found for client and type ${templateType}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Template variant assigned to client for ${templateType}`,
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
    console.error('[ABTesting] POST /api/admin/templates/assign error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
