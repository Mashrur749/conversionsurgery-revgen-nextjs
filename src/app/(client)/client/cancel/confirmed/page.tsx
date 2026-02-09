import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CancellationConfirmedPage() {
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cancellation Confirmed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your subscription has been cancelled.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>7-day grace period:</strong> Your account remains active for 7 more days.
              You can reactivate anytime before then.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            We&apos;re sorry to see you go. If you change your mind, we&apos;d love to have you back.
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/client">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
