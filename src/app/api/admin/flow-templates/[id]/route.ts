import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { flowTemplates, flowTemplateSteps } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logDeleteAudit } from '@/lib/services/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/flow-templates/[id]
 * Get a single template with steps
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.FLOWS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;
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

/**
 * PATCH /api/admin/flow-templates/[id]
 * Update a template and its steps
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.FLOWS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;
  const db = getDb();

  try {
    const body = (await request.json()) as Record<string, any>;
    const { steps, ...templateData } = body;

    // Update template
    await db
      .update(flowTemplates)
      .set({
        ...templateData,
        updatedAt: new Date(),
      })
      .where(eq(flowTemplates.id, id));

    // Update steps if provided
    if (steps) {
      await db
        .delete(flowTemplateSteps)
        .where(eq(flowTemplateSteps.templateId, id));

      for (const step of steps) {
        await db.insert(flowTemplateSteps).values({
          templateId: id,
          stepNumber: step.stepNumber,
          name: step.name,
          delayMinutes: step.delayMinutes,
          messageTemplate: step.messageTemplate,
          skipConditions: step.skipConditions,
        });
      }
    }

    console.log('[FlowEngine] Updated template:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FlowEngine] Template update error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/flow-templates/[id]
 * Delete a template
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.FLOWS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;
  const db = getDb();

  const [deleted] = await db.delete(flowTemplates).where(eq(flowTemplates.id, id)).returning();
  if (deleted) {
    await logDeleteAudit({ resourceType: 'flow_template', resourceId: id, metadata: { name: deleted.name } });
  }

  console.log('[FlowEngine] Deleted template:', id);
  return NextResponse.json({ success: true });
}
