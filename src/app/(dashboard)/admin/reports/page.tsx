import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getDb } from '@/db';
import { reports, clients } from '@/db/schema';

interface ReportListMetrics {
  messagesSent?: number;
}

interface ReportListRoiSummary {
  conversionRate?: number;
}

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect('/login');
  }

  const db = getDb();

  const allReports = await db
    .select()
    .from(reports)
    .orderBy(reports.createdAt);

  const allClients = await db.select().from(clients);
  const clientMap = new Map(allClients.map((c) => [c.id, c]));

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
          <p className="text-3xl font-bold mt-2">{totalReports}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">Bi-Weekly</p>
          <p className="text-3xl font-bold mt-2">{biWeeklyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Sent every 2 weeks</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">Monthly</p>
          <p className="text-3xl font-bold mt-2">{monthlyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Sent every month</p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {allReports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No reports generated yet.</p>
            <Link href="/admin/reports/new" className="mt-4 inline-block">
              <Button>Generate Your First Report</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F9FA] border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Metrics
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allReports.map((report) => {
                  const client = clientMap.get(report.clientId);
                  const metrics = (report.metrics as ReportListMetrics) || {};
                  const roiSummary = (report.roiSummary as ReportListRoiSummary) || {};

                  return (
                    <tr key={report.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {report.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {client?.businessName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded-md bg-sage-light text-forest text-xs font-medium">
                          {report.reportType === 'bi-weekly'
                            ? 'Bi-Weekly'
                            : report.reportType === 'monthly'
                              ? 'Monthly'
                              : 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {report.startDate} to {report.endDate}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="text-xs">
                          <div>
                            {metrics.messagesSent || 0} messages
                          </div>
                          <div>
                            {(roiSummary.conversionRate || 0).toFixed(1)}%
                            conversion
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link href={`/admin/reports/${report.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
