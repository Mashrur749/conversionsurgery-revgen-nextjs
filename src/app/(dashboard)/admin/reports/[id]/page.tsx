import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getDb } from '@/db';
import { reports, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import ReportDetailCard from '../components/report-detail-card';
import ReportMetricsGrid from '../components/report-metrics-grid';
import ReportPerformanceChart from '../components/report-performance-chart';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect('/login');
  }

  const { id } = await params;
  const db = getDb();

  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Report Not Found</h1>
        <p className="text-gray-600">
          The report you're looking for doesn't exist.
        </p>
        <Link href="/admin/reports">
          <Button>← Back to Reports</Button>
        </Link>
      </div>
    );
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, report.clientId))
    .limit(1);

  const metrics = (report.metrics as any) || {};
  const roiSummary = (report.roiSummary as any) || {};
  const teamPerformance = (report.teamPerformance as any) || {};
  const performanceData = (report.performanceData as any) || [];
  const testResults = (report.testResults as any) || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{report.title}</h1>
          <p className="text-gray-600 mt-1">
            {client?.businessName || 'Unknown Client'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {report.startDate} to {report.endDate}
          </p>
        </div>
        <span className="px-3 py-1 rounded-md bg-blue-100 text-blue-800 text-sm font-medium">
          {report.reportType === 'bi-weekly'
            ? 'Bi-Weekly'
            : report.reportType === 'monthly'
              ? 'Monthly'
              : 'Custom'}
        </span>
      </div>

      {/* ROI Summary */}
      <ReportMetricsGrid roiSummary={roiSummary} metrics={metrics} />

      {/* Performance Chart */}
      {performanceData.length > 0 && (
        <ReportPerformanceChart data={performanceData} />
      )}

      {/* Details Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance */}
        <ReportDetailCard title="Team Performance">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Members</span>
              <span className="font-semibold">
                {teamPerformance.totalMembers || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Members</span>
              <span className="font-semibold">
                {teamPerformance.activeMembers || 0}
              </span>
            </div>
          </div>
        </ReportDetailCard>

        {/* Period Summary */}
        <ReportDetailCard title="Period Summary">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Days in Period</span>
              <span className="font-semibold">{metrics.days || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg Messages/Day</span>
              <span className="font-semibold">
                {roiSummary.averagePerDay || '0'}
              </span>
            </div>
          </div>
        </ReportDetailCard>
      </div>

      {/* A/B Test Results */}
      {testResults.length > 0 && (
        <ReportDetailCard title="A/B Tests Running During Period">
          <div className="space-y-4">
            {testResults.map((test: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-md bg-gray-50 border"
              >
                <h4 className="font-semibold text-gray-900">{test.name}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {test.description}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Type: {test.testType}
                </p>
              </div>
            ))}
          </div>
        </ReportDetailCard>
      )}

      {/* Detailed Metrics */}
      <ReportDetailCard title="Detailed Metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-600 text-sm">Messages Sent</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.messagesSent || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Conversations</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.conversationsStarted || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Appointments Reminded</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.appointmentsReminded || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Forms Responded</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.formsResponded || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Estimates Followed Up</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.estimatesFollowedUp || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Missed Calls Captured</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.missedCallsCaptured || 0}
            </p>
          </div>
        </div>
      </ReportDetailCard>

      {/* Notes */}
      {report.notes && (
        <ReportDetailCard title="Notes">
          <p className="text-gray-700 whitespace-pre-wrap">{report.notes}</p>
        </ReportDetailCard>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Link href="/admin/reports">
          <Button variant="ghost">← Back to Reports</Button>
        </Link>
      </div>
    </div>
  );
}
