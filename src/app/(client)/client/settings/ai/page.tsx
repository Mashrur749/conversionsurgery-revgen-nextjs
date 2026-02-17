import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clientAgentSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AiSettingsForm } from './ai-settings-form';

export default async function ClientAiSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();
  const [settings] = await db
    .select()
    .from(clientAgentSettings)
    .where(eq(clientAgentSettings.clientId, session.clientId))
    .limit(1);

  const defaults = {
    agentTone: settings?.agentTone ?? 'professional',
    useEmojis: settings?.useEmojis ?? false,
    signMessages: settings?.signMessages ?? false,
    primaryGoal: settings?.primaryGoal ?? 'book_appointment',
    canScheduleAppointments: settings?.canScheduleAppointments ?? true,
    quietHoursEnabled: settings?.quietHoursEnabled ?? true,
    quietHoursStart: settings?.quietHoursStart ?? '21:00',
    quietHoursEnd: settings?.quietHoursEnd ?? '08:00',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customize how your AI assistant communicates with leads
        </p>
      </div>
      <AiSettingsForm defaults={defaults} />
    </div>
  );
}
