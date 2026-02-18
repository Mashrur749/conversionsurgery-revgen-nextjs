import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { PlatformAnalytics } from '@/components/admin/platform-analytics';

export const dynamic = 'force-dynamic';

export default async function AdminPlatformAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground">
          MRR, churn, and platform health metrics
        </p>
      </div>

      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading platform analytics...</div>}>
        <PlatformAnalytics />
      </Suspense>
    </div>
  );
}
