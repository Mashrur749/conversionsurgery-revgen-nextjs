import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientSession } from '@/lib/client-auth';
import {
  buildExportDownloadPath,
  getLatestDataExportRequest,
} from '@/lib/services/data-export-requests';
import { getLatestCancelledCancellation } from '@/lib/services/cancellation';
import {
  CANCELLATION_NOTICE_DAYS,
  EXPORT_SLA_BUSINESS_DAYS,
} from '@/lib/services/cancellation-policy';

export default async function CancellationConfirmedPage() {
  const session = await getClientSession();
  if (!session) {
    redirect('/link-expired');
  }

  const [cancellation, exportRequest] = await Promise.all([
    getLatestCancelledCancellation(session.clientId),
    getLatestDataExportRequest(session.clientId),
  ]);

  const effectiveDate = cancellation?.effectiveCancellationDate
    ? new Date(cancellation.effectiveCancellationDate)
    : null;
  const hasActiveDownload = exportRequest?.downloadToken
    && exportRequest.downloadTokenExpiresAt
    && exportRequest.downloadTokenExpiresAt.getTime() > Date.now();

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cancellation Confirmed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your cancellation notice has been recorded.
          </p>

          <div className="bg-[#FFF3E0] border border-sienna/30 rounded-lg p-4 text-left space-y-2">
            <p className="text-sm text-sienna">
              <strong>Effective cancellation date:</strong>{' '}
              {effectiveDate ? effectiveDate.toLocaleDateString() : 'Pending confirmation'}
            </p>
            <p className="text-xs text-sienna/80">
              Policy: {CANCELLATION_NOTICE_DAYS} calendar days after written notice.
            </p>
          </div>

          <div className="bg-[#E8F5E9] border border-[#3D7A50]/30 rounded-lg p-4 text-left space-y-2">
            <p className="text-sm text-[#3D7A50]">
              <strong>Data export SLA:</strong> {EXPORT_SLA_BUSINESS_DAYS} business days from cancellation notice.
            </p>
            {exportRequest ? (
              <>
                <p className="text-sm text-[#3D7A50]">
                  <strong>Current export status:</strong> {exportRequest.status}
                </p>
                <p className="text-xs text-[#3D7A50]/80">
                  Due by {new Date(exportRequest.dueAt).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="text-xs text-[#3D7A50]/80">
                Export request is being prepared.
              </p>
            )}
          </div>

          {hasActiveDownload && exportRequest ? (
            <Button asChild>
              <Link href={buildExportDownloadPath(exportRequest.id, exportRequest.downloadToken!)}>
                Download Full Data Export
              </Link>
            </Button>
          ) : null}

          <p className="text-sm text-muted-foreground">
            We&apos;re sorry to see you go. If you change your mind, contact support and we can help reactivate your account before the effective cancellation date.
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/client">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
