import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getDb } from '@/db';
import { reports, clients } from '@/db/schema';
import ReportDeliveryOpsPanel from './components/report-delivery-ops-panel';
import { ReportsTableWithFilters } from './components/reports-table-with-filters';

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/login');
  }

  const db = getDb();

  const allReports = await db
    .select()
    .from(reports)
    .orderBy(reports.createdAt);

  const allClients = await db.select().from(clients);

  const totalReports = allReports.length;
  const biWeeklyCount = allReports.filter(
    (r) => r.reportType === 'bi-weekly'
  ).length;
  const monthlyCount = allReports.filter(
    (r) => r.reportType === 'monthly'
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-2">
            Generate and manage client reports
          </p>
        </div>
        <Link href="/admin/reports/new">
          <Button>Generate New Report</Button>
        </Link>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">Total Reports</p>
          <p className="text-2xl font-bold mt-2">{totalReports}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">Bi-Weekly</p>
          <p className="text-2xl font-bold mt-2">{biWeeklyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Sent every 2 weeks</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">Monthly</p>
          <p className="text-2xl font-bold mt-2">{monthlyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Sent every month</p>
        </div>
      </div>

      {/* Report Delivery Operations */}
      <ReportDeliveryOpsPanel />

      {/* Reports Table with Filters */}
      <ReportsTableWithFilters
        reports={allReports.map((r) => ({
          id: r.id,
          title: r.title,
          clientId: r.clientId,
          reportType: r.reportType,
          startDate: r.startDate,
          endDate: r.endDate,
          metrics: r.metrics,
          roiSummary: r.roiSummary,
        }))}
        clients={allClients
          .map((c) => ({ id: c.id, businessName: c.businessName }))
          .sort((a, b) => a.businessName.localeCompare(b.businessName))}
        clientMap={Object.fromEntries(
          allClients.map((c) => [c.id, { id: c.id, businessName: c.businessName }])
        )}
      />
    </div>
  );
}
