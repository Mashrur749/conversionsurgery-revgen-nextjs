import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import { flowTemplates, flowTemplateSteps } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TemplateEditor } from '@/components/flows/template-editor';
import { VersionHistory, PublishButton } from './version-history';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateEditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const { id } = await params;
  const isNew = id === 'new';

  let template = null;
  let steps: any[] = [];

  if (!isNew) {
    const db = getDb();
    const [found] = await db
      .select()
      .from(flowTemplates)
      .where(eq(flowTemplates.id, id))
      .limit(1);

    if (!found) notFound();
    template = found;

    steps = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.templateId, id))
      .orderBy(flowTemplateSteps.stepNumber);
  }

  return (
    <div className="space-y-6">
      <TemplateEditor template={template} steps={steps} isNew={isNew} />
      {!isNew && template && (
        <>
          <div className="flex items-center gap-4">
            <PublishButton templateId={id} />
            <span className="text-sm text-muted-foreground">
              Current version: v{template.version ?? 1}
            </span>
          </div>
          <VersionHistory templateId={id} />
        </>
      )}
    </div>
  );
}
