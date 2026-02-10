import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/client-auth';
import { getBillingData } from '@/lib/billing/queries';
import { BillingPageClient } from './billing-client';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Billing | ConversionSurgery',
};

async function BillingContent() {
  const session = await getClientSession();
  if (!session) {
    redirect('/link-expired');
  }

  const data = await getBillingData(session.clientId);

  return <BillingPageClient clientId={session.clientId} data={data} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContent />
    </Suspense>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
