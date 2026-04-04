import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/client-auth';
import { getBillingData } from '@/lib/billing/queries';
import { BillingPageClient } from './billing-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const metadata = {
  title: 'Billing | ConversionSurgery',
};

async function BillingContent() {
  const session = await getClientSession();
  if (!session) {
    redirect('/link-expired');
  }

  const db = getDb();
  const [clientRows, data] = await Promise.all([
    db
      .select({ serviceModel: clients.serviceModel })
      .from(clients)
      .where(eq(clients.id, session.clientId))
      .limit(1),
    getBillingData(session.clientId),
  ]);

  const serviceModel = clientRows[0]?.serviceModel ?? 'managed';

  return <BillingPageClient clientId={session.clientId} serviceModel={serviceModel} data={data} />;
}

export default function BillingPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Billing' }]} />
      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent />
      </Suspense>
    </>
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
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64" />
        </div>
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-96" />
    </div>
  );
}
