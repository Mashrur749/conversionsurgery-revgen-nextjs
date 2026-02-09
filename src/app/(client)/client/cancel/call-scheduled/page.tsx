import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CallScheduledPage() {
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <Card className="border-green-500">
        <CardHeader>
          <CardTitle>Call Scheduled!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We&apos;ll call you tomorrow at 10am to discuss your concerns.
          </p>
          <p className="text-sm text-muted-foreground">
            Your account remains active. No action needed until we talk.
          </p>
        </CardContent>
      </Card>

      <Button asChild>
        <Link href="/client">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
