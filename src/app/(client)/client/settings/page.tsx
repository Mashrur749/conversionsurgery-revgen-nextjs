import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummarySettings } from './summary-settings';

export default async function ClientSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

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
    </div>
  );
}
