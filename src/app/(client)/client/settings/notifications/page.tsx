import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getNotificationPrefs } from '@/lib/services/notification-preferences';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { NotificationSettingsForm } from './notification-settings-form';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';

export default async function NotificationSettingsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.SETTINGS_EDIT);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const prefs = await getNotificationPrefs(session.clientId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/client/settings">Back</Link>
        </Button>
      </div>

      <NotificationSettingsForm initialPrefs={prefs} />
    </div>
  );
}
