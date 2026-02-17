import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { abTests, clients } from '@/db/schema';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ABTestsList } from './components/ab-tests-list';

/**
 * A/B Testing Dashboard Page
 * Lists all tests grouped by status with overview statistics
 */
export default async function ABTestsPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();

  // Get all A/B tests with client info
  const allTests = await db.select().from(abTests);
  const allClients = await db.select().from(clients);

  // Enhance tests with client names
  const testsWithClients = allTests.map((test) => {
    const client = allClients.find((c) => c.id === test.clientId);
    return {
      ...test,
      clientName: client?.businessName || 'Unknown Client',
      clientEmail: client?.email || '',
    };
  });

  // Group by status
  const activeTests = testsWithClients.filter((t) => t.status === 'active');
  const pausedTests = testsWithClients.filter((t) => t.status === 'paused');
  const completedTests = testsWithClients.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground mt-2">
            Run and track experiments to optimize client performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/ab-tests/new">+ New Test</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">← Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-sage-light p-4 rounded-lg border border-forest-light/30">
          <p className="text-sm text-forest font-medium">Active Tests</p>
          <p className="text-3xl font-bold mt-2">{activeTests.length}</p>
          <p className="text-xs text-forest-light mt-1">Currently running</p>
        </div>
        <div className="bg-accent p-4 rounded-lg border border-olive/30">
          <p className="text-sm text-olive font-medium">Paused</p>
          <p className="text-3xl font-bold mt-2">{pausedTests.length}</p>
          <p className="text-xs text-olive mt-1">Ready to resume</p>
        </div>
        <div className="bg-[#E8F5E9] p-4 rounded-lg border border-[#3D7A50]/30">
          <p className="text-sm text-[#3D7A50] font-medium">Completed</p>
          <p className="text-3xl font-bold mt-2">{completedTests.length}</p>
          <p className="text-xs text-[#3D7A50] mt-1">Results available</p>
        </div>
      </div>

      {/* Tests Lists */}
      {activeTests.length > 0 && (
        <ABTestsList title="Active Tests" tests={activeTests} status="active" />
      )}

      {pausedTests.length > 0 && (
        <ABTestsList title="Paused Tests" tests={pausedTests} status="paused" />
      )}

      {completedTests.length > 0 && (
        <ABTestsList
          title="Completed Tests"
          tests={completedTests}
          status="completed"
        />
      )}

      {testsWithClients.length === 0 && (
        <div className="text-center py-12 bg-[#F8F9FA] rounded-lg border">
          <p className="text-muted-foreground mb-4">No tests yet</p>
          <Button asChild>
            <Link href="/admin/ab-tests/new">Create your first test</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
