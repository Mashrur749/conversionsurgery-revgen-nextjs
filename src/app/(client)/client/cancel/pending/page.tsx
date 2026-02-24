import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientSession } from '@/lib/client-auth';
import { getPendingCancellation } from '@/lib/services/cancellation';

export default async function PendingCancellationPage() {
  const session = await getClientSession();
  if (!session) {
    redirect('/link-expired');
  }

  const pending = await getPendingCancellation(session.clientId);
  if (!pending) {
    redirect('/client/cancel');
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Cancellation Request Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your request is being processed. Please check back shortly.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/client">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
