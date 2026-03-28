import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { SummarySettings } from './summary-settings';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';

export default async function ClientSettingsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.SETTINGS_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();
  const [client] = await db
    .select({ twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(eq(clients.id, session.clientId))
    .limit(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Business Phone Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          {client?.twilioNumber ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-semibold">{formatPhoneNumber(client.twilioNumber)}</p>
                <p className="text-sm text-muted-foreground">Active business line</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/client/settings/phone">Manage</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No phone number set up yet. A dedicated business line is required for automated responses.
              </p>
              <Button asChild>
                <Link href="/client/settings/phone">Set Up Phone</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
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
