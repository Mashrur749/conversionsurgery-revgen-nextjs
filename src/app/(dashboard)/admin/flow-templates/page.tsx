import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { flowTemplates } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { TemplateList } from '@/components/flows/template-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function FlowTemplatesPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const db = getDb();
  const templates = await db
    .select()
    .from(flowTemplates)
    .orderBy(desc(flowTemplates.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flow Templates</h1>
          <p className="text-muted-foreground">
            Manage reusable flow sequences for clients
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/flow-templates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      <TemplateList templates={templates} />
    </div>
  );
}
