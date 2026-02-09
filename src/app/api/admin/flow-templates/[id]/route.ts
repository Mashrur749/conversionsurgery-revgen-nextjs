import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, flowTemplates, flowTemplateSteps } from '@/db';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  try {
    const body = await request.json();
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Flow Templates] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  await db.delete(flowTemplates).where(eq(flowTemplates.id, id));

  return NextResponse.json({ success: true });
}
