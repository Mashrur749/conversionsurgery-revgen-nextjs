import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, clientAgentSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getNotificationPrefs } from '@/lib/services/notification-preferences';
import { AI_ASSIST_CATEGORY } from '@/lib/services/ai-send-policy';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';

import { SettingsTabs } from './settings-tabs';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SummarySettings } from './summary-settings';
import { NotificationSettingsForm } from './notifications/notification-settings-form';
import { AiSettingsForm } from './ai/ai-settings-form';
import { PhoneProvisioner } from './phone/phone-provisioner';
import { FeatureTogglesForm } from './features/feature-toggles-form';

export default async function ClientSettingsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.SETTINGS_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();

  // Fetch all data in parallel
  const [clientRows, agentSettingsRows, notificationPrefs] = await Promise.all([
    db
      .select({
        twilioNumber: clients.twilioNumber,
        businessName: clients.businessName,
        serviceModel: clients.serviceModel,
      })
      .from(clients)
      .where(eq(clients.id, session.clientId))
      .limit(1),
    db
      .select()
      .from(clientAgentSettings)
      .where(eq(clientAgentSettings.clientId, session.clientId))
      .limit(1),
    getNotificationPrefs(session.clientId),
  ]);

  const clientData = clientRows[0];
  const agentSettings = agentSettingsRows[0];
  const { client } = session;

  // AI settings defaults
  const aiDefaults = {
    agentTone: agentSettings?.agentTone ?? 'professional',
    useEmojis: agentSettings?.useEmojis ?? false,
    signMessages: agentSettings?.signMessages ?? false,
    primaryGoal: agentSettings?.primaryGoal ?? 'book_appointment',
    canScheduleAppointments: agentSettings?.canScheduleAppointments ?? true,
    quietHoursEnabled: agentSettings?.quietHoursEnabled ?? true,
    quietHoursStart: agentSettings?.quietHoursStart ?? '21:00',
    quietHoursEnd: agentSettings?.quietHoursEnd ?? '08:00',
    bookingAggressiveness: agentSettings?.bookingAggressiveness ?? 5,
  };

  // Feature toggles defaults
  const featureDefaults = {
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
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/client' },
        { label: 'Settings' },
      ]} />
      <h1 className="text-2xl font-bold">Settings</h1>

      <SettingsTabs serviceModel={clientData?.serviceModel ?? 'managed'}>
        {{
          general: (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Weekly Summary</h2>
                <p className="text-sm text-muted-foreground">
                  Configure when you receive your weekly summary
                </p>
              </div>
              <SummarySettings
                enabled={client.weeklySummaryEnabled ?? true}
                day={client.weeklySummaryDay ?? 1}
                time={client.weeklySummaryTime ?? '08:00'}
              />
            </div>
          ),
          notifications: (
            <NotificationSettingsForm initialPrefs={notificationPrefs} />
          ),
          ai: (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <p className="text-sm text-muted-foreground">
                  Customize how your AI assistant communicates with leads
                </p>
              </div>
              <AiSettingsForm defaults={aiDefaults} />
            </div>
          ),
          phone: (
            <PhoneProvisioner
              currentNumber={clientData?.twilioNumber ?? null}
              businessName={clientData?.businessName ?? ''}
            />
          ),
          features: (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Features</h2>
                <p className="text-sm text-muted-foreground">
                  Control which features are active for your account
                </p>
              </div>
              <FeatureTogglesForm defaults={featureDefaults} />
            </div>
          ),
        }}
      </SettingsTabs>
    </div>
  );
}
