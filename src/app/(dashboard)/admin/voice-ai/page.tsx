import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, systemSettings, clientAgentSettings, knowledgeBase, businessHours } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { CallHistory } from '@/components/voice/call-history';
import { VoicePicker } from './voice-picker';
import { VoiceKillSwitch } from './voice-kill-switch';
import { VoiceComparison } from './voice-comparison';
import { VoiceQaChecklist } from './voice-qa-checklist';
import { VoicePlayground } from './voice-playground';
import { ChevronDown } from 'lucide-react';

export default async function VoiceAIPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  const [killSwitchRow] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'ops.kill_switch.voice_ai'))
    .limit(1);
  const isKilled = killSwitchRow?.value === 'true';

  const allClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      voiceEnabled: clients.voiceEnabled,
      voiceMode: clients.voiceMode,
      voiceGreeting: clients.voiceGreeting,
      voiceVoiceId: clients.voiceVoiceId,
      voiceMaxDuration: clients.voiceMaxDuration,
    })
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  const agentSettingsRows = await db
    .select({
      clientId: clientAgentSettings.clientId,
      agentTone: clientAgentSettings.agentTone,
      canDiscussPricing: clientAgentSettings.canDiscussPricing,
    })
    .from(clientAgentSettings);
  const agentSettingsMap = new Map(agentSettingsRows.map(r => [r.clientId, r]));

  // KB entry counts per client
  const kbCounts = await db
    .select({
      clientId: knowledgeBase.clientId,
      count: count(knowledgeBase.id),
    })
    .from(knowledgeBase)
    .groupBy(knowledgeBase.clientId);
  const kbCountMap = new Map(kbCounts.map(r => [r.clientId, Number(r.count)]));

  // Business hours existence per client
  const hoursClients = await db
    .selectDistinct({ clientId: businessHours.clientId })
    .from(businessHours);
  const hoursSet = new Set(hoursClients.map(r => r.clientId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Voice AI</h1>
        <p className="text-muted-foreground">
          Configure AI-powered voice answering for client phone lines
        </p>
      </div>

      <VoiceKillSwitch isKilled={isKilled} />

      {allClients.length === 0 ? (
        <p className="text-muted-foreground">No active clients found.</p>
      ) : (
        <div className="space-y-4">
          {allClients.map((client) => (
            <details key={client.id} className="group rounded-lg border bg-card">
              <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-lg font-semibold list-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  {client.businessName}
                  {client.voiceEnabled && (
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#3D7A50]">Enabled</span>
                  )}
                  {agentSettingsMap.get(client.id)?.agentTone && (
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {agentSettingsMap.get(client.id)?.agentTone}
                    </span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-2 pt-0">
                <VoiceQaChecklist
                  clientId={client.id}
                  voiceEnabled={client.voiceEnabled ?? false}
                  checks={{
                    greetingSet: !!(client.voiceGreeting && client.voiceGreeting.trim().length > 0),
                    voiceSelected: !!client.voiceVoiceId,
                    kbPopulated: (kbCountMap.get(client.id) ?? 0) >= 3,
                    businessHoursSet: hoursSet.has(client.id),
                    agentToneSet: !!(agentSettingsMap.get(client.id)?.agentTone),
                  }}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 pb-6">
                <div className="space-y-4">
                  <VoiceSettings
                    clientId={client.id}
                    settings={{
                      voiceEnabled: client.voiceEnabled ?? false,
                      voiceMode: client.voiceMode ?? 'after_hours',
                      voiceGreeting: client.voiceGreeting ?? '',
                      voiceMaxDuration: client.voiceMaxDuration ?? 300,
                      canDiscussPricing:
                        agentSettingsMap.get(client.id)?.canDiscussPricing ?? false,
                    }}
                    voiceVoiceId={client.voiceVoiceId ?? null}
                  />
                  <VoicePicker
                    clientId={client.id}
                    currentVoiceId={client.voiceVoiceId ?? null}
                  />
                  <VoiceComparison
                    clientId={client.id}
                    defaultText={client.voiceGreeting || `Hi! Thanks for calling ${client.businessName}. How can I help you today?`}
                  />
                </div>
                <CallHistory clientId={client.id} />
              </div>
              <div className="px-6 pb-6">
                <VoicePlayground clientId={client.id} voiceVoiceId={client.voiceVoiceId ?? null} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
