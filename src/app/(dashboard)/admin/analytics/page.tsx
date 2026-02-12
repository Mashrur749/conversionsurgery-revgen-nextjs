import { Suspense } from 'react';
import { getDb } from '@/db';
import { flowTemplates } from '@/db/schema';
import { CategoryPerformance } from '@/components/analytics/category-performance';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const db = getDb();
  const categories = await db
    .selectDistinct({ category: flowTemplates.category })
    .from(flowTemplates);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Template Analytics</h1>
        <p className="text-muted-foreground">
          Aggregate performance across all clients
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        {categories.map(({ category }) => (
          <CategoryPerformance key={category} category={category!} />
        ))}
      </Suspense>

      {categories.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No templates found. Create flow templates to start tracking performance.
        </div>
      )}
    </div>
  );
}
