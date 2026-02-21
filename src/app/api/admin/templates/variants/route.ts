import { getDb } from '@/db';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { templateVariants } from '@/db/schema';
import { z } from 'zod';

const createVariantSchema = z.object({
  templateType: z.string().min(1, 'Template type required'),
  name: z.string().min(1, 'Variant name required').max(255),
  content: z.string().min(10, 'Template content must be at least 10 characters'),
  notes: z.string().optional(),
});

/**
 * POST /api/admin/templates/variants
 * Creates a new template variant for A/B testing
 */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ request }) => {
    const body = await request.json();
    const parsed = createVariantSchema.safeParse(body);

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

    const { templateType, name, content, notes } = parsed.data;

    const db = getDb();

    // Insert new variant
    const result = await db
      .insert(templateVariants)
      .values({
        templateType,
        name,
        content,
        notes,
        isActive: true,
      })
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template variant created',
        variant: result[0],
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }
);
