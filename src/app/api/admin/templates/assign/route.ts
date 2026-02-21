import { getDb } from '@/db';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
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
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ request }) => {
    const body = await request.json();
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
  }
);
