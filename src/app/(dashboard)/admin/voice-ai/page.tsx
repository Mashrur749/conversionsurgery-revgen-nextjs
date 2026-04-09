import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, systemSettings, clientAgentSettings, knowledgeBase, businessHours } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { VoiceKillSwitch } from './voice-kill-switch';
import { VoiceAiClientView } from './voice-ai-client-view';

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
  const agentSettingsMap: Record<string, { agentTone: string | null; canDiscussPricing: boolean | null }> =
    Object.fromEntries(agentSettingsRows.map(r => [r.clientId, r]));

  const kbCounts = await db
    .select({
      clientId: knowledgeBase.clientId,
      count: count(knowledgeBase.id),
    })
    .from(knowledgeBase)
    .groupBy(knowledgeBase.clientId);
  const kbCountMap: Record<string, number> = Object.fromEntries(
    kbCounts.map(r => [r.clientId, Number(r.count)])
  );

  const hoursClients = await db
    .selectDistinct({ clientId: businessHours.clientId })
    .from(businessHours);
  const hoursSet = hoursClients.map(r => r.clientId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Voice AI</h1>
        <p className="text-muted-foreground">
          Configure AI-powered voice answering for client phone lines
        </p>
      </div>

      <VoiceKillSwitch isKilled={isKilled} />

      <VoiceAiClientView
        clients={allClients}
        agentSettingsMap={agentSettingsMap}
        kbCountMap={kbCountMap}
        hoursSet={hoursSet}
      />
    </div>
  );
}
