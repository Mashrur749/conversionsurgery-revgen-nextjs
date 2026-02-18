import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { abTests, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TestResultsCard } from '../components/test-results-card';
import { TestActions } from '../components/test-actions';
import { format } from 'date-fns';

interface ABTestVariant {
  name?: string;
  description?: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * A/B Test Detail Page
 * Displays test configuration, variant details, results, and actions
 */
export default async function TestDetailPage({ params }: Props) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const db = getDb();

  // Get test
  const [test] = await db
    .select()
    .from(abTests)
    .where(eq(abTests.id, id))
    .limit(1);

  if (!test) {
    redirect('/admin/ab-tests');
  }

  // Get client
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, test.clientId))
    .limit(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{test.name}</h1>
          <p className="text-muted-foreground mt-2">
            {client?.businessName} • Started{' '}
            {format(test.startDate as Date, 'MMM d, yyyy')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/ab-tests">← Back to Tests</Link>
        </Button>
      </div>

      {/* Test Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="bg-[#F8F9FA] p-4 rounded-lg border">
          <p className="text-muted-foreground font-medium">Test Type</p>
          <p className="font-semibold mt-1 capitalize">{test.testType}</p>
        </div>
        <div className="bg-[#F8F9FA] p-4 rounded-lg border">
          <p className="text-muted-foreground font-medium">Status</p>
          <p className="font-semibold mt-1 capitalize">{test.status}</p>
        </div>
        <div className="bg-[#F8F9FA] p-4 rounded-lg border">
          <p className="text-muted-foreground font-medium">Duration</p>
          <p className="font-semibold mt-1">
            {test.endDate
              ? Math.ceil(
                  ((test.endDate as Date).getTime() - (test.startDate as Date).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 'Ongoing'}{' '}
            days
          </p>
        </div>
        <div className="bg-[#F8F9FA] p-4 rounded-lg border">
          <p className="text-muted-foreground font-medium">Current Winner</p>
          <p className="font-semibold mt-1">
            {test.winner ? `Variant ${test.winner}` : 'TBD'}
          </p>
        </div>
      </div>

      {test.description && (
        <div className="bg-sage-light p-4 rounded-lg border border-forest-light/30">
          <p className="text-sm text-forest">{test.description}</p>
        </div>
      )}

      {/* Variant Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-sage-light p-6 rounded-lg border border-forest-light/30">
          <h3 className="font-semibold text-lg mb-2">
            Variant A: {(test.variantA as ABTestVariant)?.name}
          </h3>
          {(test.variantA as ABTestVariant)?.description && (
            <p className="text-sm text-muted-foreground">
              {(test.variantA as ABTestVariant)?.description}
            </p>
          )}
        </div>
        <div className="bg-accent p-6 rounded-lg border border-olive/30">
          <h3 className="font-semibold text-lg mb-2">
            Variant B: {(test.variantB as ABTestVariant)?.name}
          </h3>
          {(test.variantB as ABTestVariant)?.description && (
            <p className="text-sm text-muted-foreground">
              {(test.variantB as ABTestVariant)?.description}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <TestResultsCard testId={id} status={test.status || 'active'} />

      {/* Actions */}
      <TestActions testId={id} status={test.status || 'active'} winner={test.winner} />
    </div>
  );
}
