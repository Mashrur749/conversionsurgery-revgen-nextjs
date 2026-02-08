import { getDb } from '@/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { messageTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const assignTemplateSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  templateVariantId: z.string().uuid('Invalid template variant ID'),
  templateType: z.string().min(1, 'Template type required'),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any).user?.isAdmin) {
      return new Response('Unauthorized', { status: 403 });
    }

    const body = await req.json();
    const { clientId, templateVariantId, templateType } = assignTemplateSchema.parse(body);

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

    console.error('[Template Assign API]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
