import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDb } from '@/db';
import { reports, clients } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { CheckCircle, Clock } from 'lucide-react';
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

  // Compute reports due: for each active client, find their most recent report
  // If last report + 14 days is within 7 days from now (or overdue), they're due
  const activeClients = allClients.filter(c => c.status === 'active');
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const reportsDue: { clientId: string; businessName: string; lastReportDate: Date | null; dueDate: Date | null; overdue: boolean }[] = [];

  for (const client of activeClients) {
    const clientReports = allReports
      .filter(r => r.clientId === client.id)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    const lastReport = clientReports[0];
    const lastReportDate = lastReport ? new Date(lastReport.createdAt!) : null;
    const dueDate = lastReportDate
      ? new Date(lastReportDate.getTime() + 14 * 24 * 60 * 60 * 1000)
      : new Date(new Date(client.createdAt!).getTime() + 14 * 24 * 60 * 60 * 1000);

    if (dueDate <= sevenDaysFromNow) {
      reportsDue.push({
        clientId: client.id,
        businessName: client.businessName,
        lastReportDate,
        dueDate,
        overdue: dueDate < now,
      });
    }
  }

  reportsDue.sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

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

      {/* Reports Due Queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Reports Due</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsDue.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle className="h-4 w-4 text-[#3D7A50]" />
              <span className="text-sm text-muted-foreground">All reports up to date</span>
            </div>
          ) : (
            <div className="divide-y">
              {reportsDue.map((item) => (
                <div key={item.clientId} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className={`h-4 w-4 shrink-0 ${item.overdue ? 'text-[#C15B2E]' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.businessName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.lastReportDate
                          ? `Last: ${item.lastReportDate.toLocaleDateString()}`
                          : 'No reports yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs ${item.overdue ? 'text-[#C15B2E] font-medium' : 'text-muted-foreground'}`}>
                      {item.overdue ? 'Overdue' : `Due ${item.dueDate?.toLocaleDateString()}`}
                    </span>
                    <Link href={`/admin/reports/new?clientId=${item.clientId}`}>
                      <Button size="sm" variant="outline">Generate</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
