import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ArticleEditor } from './article-editor';

export default async function HelpArticlesPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Help Articles</h1>
        <p className="text-muted-foreground">Manage FAQ and help content for clients.</p>
      </div>
      <ArticleEditor />
    </div>
  );
}
