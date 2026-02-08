import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import GenerateReportForm from '../components/generate-report-form';

export default async function NewReportPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect('/login');
  }

  const db = getDb();

  const allClients = await db.select().from(clients);
  const activeClients = allClients.filter((c) => c.status !== 'cancelled');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate New Report</h1>
        <p className="text-gray-600 mt-2">
          Create a new report for a client covering a specific date range
        </p>
      </div>

      <GenerateReportForm clients={activeClients} />

      <Link href="/admin/reports">
        <Button variant="ghost">← Back to Reports</Button>
      </Link>
    </div>
  );
}
