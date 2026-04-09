import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AiEffectivenessDashboard } from './ai-effectiveness-dashboard';

export const dynamic = 'force-dynamic';

export default async function AiEffectivenessPage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Performance</h1>
        <p className="text-muted-foreground mt-2">
          Monitor AI decision quality, model routing, and conversation outcomes
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <AiEffectivenessDashboard />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 h-24">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded mt-3" />
          </div>
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6 h-80">
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        <div className="bg-white rounded-lg border p-6 h-80">
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
