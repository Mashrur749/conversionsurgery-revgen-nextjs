import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { reports, reportDeliveries } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatPeriod(startDate: string, endDate: string): string {
  const fmt = (d: string) => {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  return `${fmt(startDate)} \u2013 ${fmt(endDate)}`;
}

function formatReportType(type: string): string {
  if (type === 'bi-weekly') return 'Bi-Weekly';
  if (type === 'monthly') return 'Monthly';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function DeliveryBadge({ state }: { state: string | null }) {
  if (!state || state === 'sent') {
    return (
      <Badge className="bg-[#E8F5E9] text-[#3D7A50] border-0 text-xs font-medium">
        Delivered
      </Badge>
    );
  }
  if (state === 'failed') {
    return (
      <Badge className="bg-[#FDEAE4] text-[#C15B2E] border-0 text-xs font-medium">
        Delivery failed
      </Badge>
    );
  }
  if (state === 'queued' || state === 'retried' || state === 'generated') {
    return (
      <Badge className="bg-[#FFF3E0] text-[#C15B2E] border-0 text-xs font-medium">
        Sending
      </Badge>
    );
  }
  return (
    <Badge className="bg-[#F1F3F0] text-[#6B7E54] border-0 text-xs font-medium">
      {state}
    </Badge>
  );
}

export default async function ClientReportsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.DASHBOARD);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { clientId } = session;
  const db = getDb();

  const rows = await db
    .select({
      id: reports.id,
      title: reports.title,
      reportType: reports.reportType,
      startDate: reports.startDate,
      endDate: reports.endDate,
      createdAt: reports.createdAt,
      deliveryState: reportDeliveries.state,
      sentAt: reportDeliveries.sentAt,
    })
    .from(reports)
    .leftJoin(reportDeliveries, eq(reportDeliveries.reportId, reports.id))
    .where(eq(reports.clientId, clientId))
    .orderBy(desc(reports.startDate), desc(reports.createdAt));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Reports' }]} />

      <div>
        <h1 className="text-2xl font-bold">Performance Reports</h1>
        <p className="text-sm text-muted-foreground">
          Bi-weekly reports showing your lead recovery results and ROI.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No reports yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
              Your first performance report will be delivered within two weeks of activation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">
                      {formatPeriod(report.startDate, report.endDate)}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {formatReportType(report.reportType)}
                    </Badge>
                    <DeliveryBadge state={report.deliveryState} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {report.title}
                  </p>
                </div>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="shrink-0 cursor-pointer gap-1.5"
                >
                  <a
                    href={`/api/client/reports/${report.id}/download`}
                    download
                  >
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
