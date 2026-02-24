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
import {
  parseReportMetrics,
  parseReportPerformanceData,
  parseReportRoiSummary,
  parseReportTeamPerformance,
  parseReportTestResults,
} from '@/lib/services/report-dto';

const CAD_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

function formatCad(value: number): string {
  return CAD_FORMATTER.format(value);
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAgency) {
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
        <h1 className="text-2xl font-bold">Report Not Found</h1>
        <p className="text-muted-foreground">
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

  const metrics = parseReportMetrics(report.metrics);
  const roiSummary = parseReportRoiSummary(report.roiSummary);
  const teamPerformance = parseReportTeamPerformance(report.teamPerformance);
  const performanceData = parseReportPerformanceData(report.performanceData);
  const testResults = parseReportTestResults(report.testResults);
  const withoutUsModel = roiSummary.withoutUsModel || null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="text-muted-foreground mt-1">
            {client?.businessName || 'Unknown Client'}
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            {report.startDate} to {report.endDate}
          </p>
        </div>
        <span className="px-3 py-1 rounded-md bg-sage-light text-forest text-sm font-medium">
          {report.reportType === 'bi-weekly'
            ? 'Bi-Weekly'
            : report.reportType === 'monthly'
              ? 'Monthly'
              : 'Custom'}
        </span>
      </div>

      <ReportMetricsGrid roiSummary={roiSummary} metrics={metrics} />

      {performanceData.length > 0 && (
        <ReportPerformanceChart data={performanceData} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportDetailCard title="Team Performance">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Members</span>
              <span className="font-semibold">
                {teamPerformance.totalMembers || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Active Members</span>
              <span className="font-semibold">
                {teamPerformance.activeMembers || 0}
              </span>
            </div>
          </div>
        </ReportDetailCard>

        <ReportDetailCard title="Period Summary">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Days in Period</span>
              <span className="font-semibold">{metrics.days || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Avg Messages/Day</span>
              <span className="font-semibold">{roiSummary.averagePerDay || '0'}</span>
            </div>
          </div>
        </ReportDetailCard>
      </div>

      {testResults.length > 0 && (
        <ReportDetailCard title="A/B Tests Running During Period">
          <div className="space-y-4">
            {testResults.map((test, idx) => (
              <div key={idx} className="p-3 rounded-md bg-[#F8F9FA] border">
                <h4 className="font-semibold text-foreground">{test.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {test.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Type: {test.testType}
                </p>
              </div>
            ))}
          </div>
        </ReportDetailCard>
      )}

      <ReportDetailCard title="Detailed Metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Messages Sent</p>
            <p className="text-2xl font-bold mt-1">{metrics.messagesSent || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Conversations</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.conversationsStarted || 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Appointments Reminded</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.appointmentsReminded || 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Forms Responded</p>
            <p className="text-2xl font-bold mt-1">{metrics.formsResponded || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Estimates Followed Up</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.estimatesFollowedUp || 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Missed Calls Captured</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.missedCallsCaptured || 0}
            </p>
          </div>
        </div>
      </ReportDetailCard>

      {withoutUsModel && (
        <ReportDetailCard title='Without Us (Directional Model)'>
          {withoutUsModel.status === 'ready' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Low</p>
                  <p className="text-xl font-semibold mt-1">
                    {formatCad(withoutUsModel.ranges.low.estimatedRevenueRisk)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {withoutUsModel.ranges.low.atRiskLeads.toFixed(1)} modeled at-risk leads
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Base</p>
                  <p className="text-xl font-semibold mt-1">
                    {formatCad(withoutUsModel.ranges.base.estimatedRevenueRisk)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {withoutUsModel.ranges.base.atRiskLeads.toFixed(1)} modeled at-risk leads
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">High</p>
                  <p className="text-xl font-semibold mt-1">
                    {formatCad(withoutUsModel.ranges.high.estimatedRevenueRisk)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {withoutUsModel.ranges.high.atRiskLeads.toFixed(1)} modeled at-risk leads
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-md bg-[#F8F9FA] p-3">
                  <p className="text-muted-foreground">After-hours leads</p>
                  <p className="font-semibold mt-1">
                    {withoutUsModel.inputs.afterHoursLeadCount}
                  </p>
                </div>
                <div className="rounded-md bg-[#F8F9FA] p-3">
                  <p className="text-muted-foreground">Observed avg first response</p>
                  <p className="font-semibold mt-1">
                    {withoutUsModel.inputs.averageObservedResponseMinutes !== null
                      ? `${withoutUsModel.inputs.averageObservedResponseMinutes.toFixed(2)} min`
                      : 'n/a'}
                  </p>
                </div>
                <div className="rounded-md bg-[#F8F9FA] p-3">
                  <p className="text-muted-foreground">Delayed follow-up count</p>
                  <p className="font-semibold mt-1">
                    {withoutUsModel.inputs.delayedFollowupCount}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {withoutUsModel.assumptions.disclaimer}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Insufficient data for this period to compute a directional "Without Us"
                range.
              </p>
              <p className="text-xs text-muted-foreground">
                Missing inputs: {withoutUsModel.missingInputs.join(', ')}
              </p>
            </div>
          )}
        </ReportDetailCard>
      )}

      {report.notes && (
        <ReportDetailCard title="Notes">
          <p className="text-foreground whitespace-pre-wrap">{report.notes}</p>
        </ReportDetailCard>
      )}

      <div className="flex gap-3 pt-4">
        <Link href="/admin/reports">
          <Button variant="ghost">← Back to Reports</Button>
        </Link>
      </div>
    </div>
  );
}
