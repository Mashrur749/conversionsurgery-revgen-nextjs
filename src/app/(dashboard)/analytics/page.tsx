import { Suspense } from 'react';
import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const clientId = await getClientId();

  if (session.user.isAdmin && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-2">Select a Client</h2>
        <p className="text-muted-foreground">
          Use the dropdown in the header to select a client to view analytics for.
        </p>
      </div>
    );
  }

  if (!clientId) {
    return <div>No client linked to account</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics &amp; ROI</h1>
        <p className="text-muted-foreground">
          Track your leads, conversions, and revenue
        </p>
      </div>

      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading analytics...</div>}>
        <AnalyticsDashboard clientId={clientId} />
      </Suspense>
    </div>
  );
}
