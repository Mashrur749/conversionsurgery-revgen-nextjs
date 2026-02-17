import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SummarySettings } from './summary-settings';

export default async function ClientSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <SummarySettings
            enabled={session.client.weeklySummaryEnabled ?? true}
            day={session.client.weeklySummaryDay ?? 1}
            time={session.client.weeklySummaryTime ?? '08:00'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/client/settings/notifications">
              Manage Notifications
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Assistant</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/client/settings/ai">
              Configure AI Settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/client/settings/features">
              Manage Features
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="destructive">
            <Link href="/client/cancel">
              Cancel Subscription
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
