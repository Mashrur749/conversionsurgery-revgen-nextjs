import { Suspense } from 'react';
import { getDb } from '@/db';
import { flowTemplates } from '@/db/schema';
import { CategoryPerformance } from '@/components/analytics/category-performance';
import { TemplatePerformanceDashboard } from '../template-performance/components/template-performance-dashboard';
import { AnalyticsViewToggle } from './analytics-view-toggle';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ view?: string }>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const { view } = await searchParams;
  const showVariants = view === 'variants';

  const db = getDb();
  const categories = await db
    .selectDistinct({ category: flowTemplates.category })
    .from(flowTemplates);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flow Analytics</h1>
          <p className="text-muted-foreground">
            Aggregate performance across all clients
          </p>
        </div>
        <AnalyticsViewToggle current={showVariants ? 'variants' : 'category'} />
      </div>

      {showVariants ? (
        <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading variant data...</div>}>
          <TemplatePerformanceDashboard />
        </Suspense>
      ) : (
        <>
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading analytics...</div>}>
            {categories.map(({ category }) => (
              <CategoryPerformance key={category} category={category!} />
            ))}
          </Suspense>

          {categories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No templates found. Create flow templates to start tracking performance.
            </div>
          )}
        </>
      )}
    </div>
  );
}
