import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { flowTemplates, flowTemplateSteps } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

/** POST /api/admin/flow-templates/[id]/clone - Duplicate a template with all steps. */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();

    const [template] = await db
      .select()
      .from(flowTemplates)
      .where(eq(flowTemplates.id, id))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const steps = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.templateId, id))
      .orderBy(asc(flowTemplateSteps.stepNumber));

    // Create cloned template
    const [cloned] = await db
      .insert(flowTemplates)
      .values({
        name: `${template.name} (Copy)`,
        slug: `${template.slug}-copy-${Date.now()}`,
        description: template.description,
        category: template.category,
        defaultTrigger: template.defaultTrigger,
        defaultApprovalMode: template.defaultApprovalMode,
        tags: template.tags,
        isPublished: false,
        version: 1,
        usageCount: 0,
      })
      .returning();

    // Clone steps
    if (steps.length > 0) {
      await db.insert(flowTemplateSteps).values(
        steps.map((step) => ({
          templateId: cloned.id,
          stepNumber: step.stepNumber,
          name: step.name,
          delayMinutes: step.delayMinutes,
          messageTemplate: step.messageTemplate,
          skipConditions: step.skipConditions,
        }))
      );
    }

    return NextResponse.json({ template: cloned }, { status: 201 });
  }
);
