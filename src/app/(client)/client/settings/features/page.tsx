import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { FeatureTogglesForm } from './feature-toggles-form';
import { CalendarConnection } from './calendar-connection';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { AI_ASSIST_CATEGORY } from '@/lib/services/ai-send-policy';

export default async function ClientFeaturesPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.SETTINGS_EDIT);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { client } = session;

  const defaults = {
    missedCallSmsEnabled: client.missedCallSmsEnabled ?? true,
    aiResponseEnabled: client.aiResponseEnabled ?? true,
    smartAssistEnabled: client.smartAssistEnabled ?? true,
    smartAssistDelayMinutes: client.smartAssistDelayMinutes ?? 5,
    smartAssistManualCategories: (client.smartAssistManualCategories as string[] | null) ?? [
      AI_ASSIST_CATEGORY.ESTIMATE_FOLLOWUP,
      AI_ASSIST_CATEGORY.PAYMENT,
    ],
    photoRequestsEnabled: client.photoRequestsEnabled ?? true,
    notificationEmail: client.notificationEmail ?? true,
    notificationSms: client.notificationSms ?? true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Features</h1>
        <p className="text-sm text-muted-foreground">
          Control which features are active for your account
        </p>
      </div>
      <FeatureTogglesForm defaults={defaults} />
      <CalendarConnection />
    </div>
  );
}
