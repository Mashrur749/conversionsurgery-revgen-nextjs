import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getValueSummary, getPendingCancellation } from '@/lib/services/cancellation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CancellationFlow } from './cancellation-flow';

export default async function CancelPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  // Check for pending cancellation
  const pending = await getPendingCancellation(session.clientId);
  if (pending) {
    redirect('/client/cancel/pending');
  }

  const valueSummary = await getValueSummary(session.clientId);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold">We&apos;re Sorry to See You Go</h1>
        <p className="text-muted-foreground mt-2">
          Before you leave, take a look at what you&apos;d be giving up
        </p>
      </div>

      {/* Value Summary Card */}
      <Card className="border-2 border-green-500 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">Your Results So Far</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-700">{valueSummary.totalLeads}</p>
              <p className="text-sm text-green-600">Leads Captured</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-700">{valueSummary.totalMessages}</p>
              <p className="text-sm text-green-600">Messages Sent</p>
            </div>
          </div>

          <div className="border-t border-green-200 pt-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-700">
                ${valueSummary.estimatedRevenue.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">Estimated Revenue Generated</p>
            </div>
          </div>

          <div className="bg-green-100 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-green-800">
              {valueSummary.roi}% ROI
            </p>
            <p className="text-xs text-green-600">
              ${valueSummary.monthlyCost}/mo investment → ${valueSummary.estimatedRevenue.toLocaleString()} return
            </p>
          </div>
        </CardContent>
      </Card>

      <CancellationFlow clientId={session.clientId} valueSummary={valueSummary} />

      <div className="text-center">
        <Button asChild variant="link">
          <Link href="/client">← Never mind, take me back</Link>
        </Button>
      </div>
    </div>
  );
}
