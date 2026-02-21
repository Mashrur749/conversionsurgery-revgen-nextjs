import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { flowTemplates, flowTemplateSteps } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logDeleteAudit } from '@/lib/services/audit';

/**
 * GET /api/admin/flow-templates/[id]
 * Get a single template with steps
 */
export const GET = adminRoute<{ id: string }>(
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const steps = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.templateId, id))
      .orderBy(flowTemplateSteps.stepNumber);

    return NextResponse.json({ ...template, steps });
  }
);

/**
 * PATCH /api/admin/flow-templates/[id]
 * Update a template and its steps
 */
export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async ({ request, params }) => {
    const { id } = params;
    const db = getDb();

    const body = (await request.json()) as Record<string, unknown>;
    const { steps, ...templateData } = body;

    // Update template
    await db
      .update(flowTemplates)
      .set({
        ...(templateData as Record<string, unknown>),
        updatedAt: new Date(),
      })
      .where(eq(flowTemplates.id, id));

    // Update steps if provided
    if (steps) {
      await db
        .delete(flowTemplateSteps)
        .where(eq(flowTemplateSteps.templateId, id));

      for (const step of steps as Array<Record<string, unknown>>) {
        await db.insert(flowTemplateSteps).values({
          templateId: id,
          stepNumber: step.stepNumber as number,
          name: step.name as string | undefined,
          delayMinutes: step.delayMinutes as number,
          messageTemplate: step.messageTemplate as string,
          skipConditions: step.skipConditions as Record<string, boolean> | undefined,
        });
      }
    }

    console.log('[FlowEngine] Updated template:', id);
    return NextResponse.json({ success: true });
  }
);

/**
 * DELETE /api/admin/flow-templates/[id]
 * Delete a template
 */
export const DELETE = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();

    const [deleted] = await db.delete(flowTemplates).where(eq(flowTemplates.id, id)).returning();
    if (deleted) {
      await logDeleteAudit({ resourceType: 'flow_template', resourceId: id, metadata: { name: deleted.name } });
    }

    console.log('[FlowEngine] Deleted template:', id);
    return NextResponse.json({ success: true });
  }
);
