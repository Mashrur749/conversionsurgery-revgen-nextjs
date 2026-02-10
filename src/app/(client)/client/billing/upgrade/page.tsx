import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/client-auth';
import { getPlans, getCurrentSubscription } from '@/lib/billing/queries';
import { UpgradePageClient } from './upgrade-client';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Upgrade Plan | ConversionSurgery',
};

async function UpgradeContent() {
  const session = await getClientSession();
  if (!session) {
    redirect('/link-expired');
  }

  const [allPlans, currentSubscription] = await Promise.all([
    getPlans(),
    getCurrentSubscription(session.clientId),
  ]);

  return (
    <UpgradePageClient
      clientId={session.clientId}
      plans={allPlans}
      currentPlanId={currentSubscription?.planId || null}
    />
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<UpgradeSkeleton />}>
      <UpgradeContent />
    </Suspense>
  );
}

function UpgradeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto mt-2" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
