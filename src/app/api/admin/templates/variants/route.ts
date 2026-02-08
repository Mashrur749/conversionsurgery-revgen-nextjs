import { getDb } from '@/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { templateVariants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createVariantSchema = z.object({
  templateType: z.string().min(1, 'Template type required'),
  name: z.string().min(1, 'Variant name required').max(255),
  content: z.string().min(10, 'Template content must be at least 10 characters'),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any).user?.isAdmin) {
      return new Response('Unauthorized', { status: 403 });
    }

    const body = await req.json();
    const { templateType, name, content, notes } = createVariantSchema.parse(body);

    const db = getDb();

    // Check if variant with same type and name already exists
    const existing = await db
      .select()
      .from(templateVariants)
      .where(
        eq(templateVariants.templateType, templateType)
      )
      .limit(1);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation error',
          details: error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A variant with this type and name already exists',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('[Template Variants API]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
