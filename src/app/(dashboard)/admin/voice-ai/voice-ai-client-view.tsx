'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { CallHistory } from '@/components/voice/call-history';
import { VoicePicker } from './voice-picker';
import { VoiceComparison } from './voice-comparison';
import { VoiceQaChecklist } from './voice-qa-checklist';
import { VoicePlayground } from './voice-playground';

interface ClientData {
  id: string;
  businessName: string;
  voiceEnabled: boolean | null;
  voiceMode: string | null;
  voiceGreeting: string | null;
  voiceVoiceId: string | null;
  voiceMaxDuration: number | null;
}

interface AgentSettings {
  agentTone: string | null;
  canDiscussPricing: boolean | null;
}

interface Props {
  clients: ClientData[];
  agentSettingsMap: Record<string, AgentSettings>;
  kbCountMap: Record<string, number>;
  hoursSet: string[];
}

export function VoiceAiClientView({ clients, agentSettingsMap, kbCountMap, hoursSet }: Props) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '');

  const client = clients.find((c) => c.id === selectedId);

  if (clients.length === 0) {
    return <p className="text-muted-foreground">No active clients found.</p>;
  }

  if (!client) return null;

  const agentSettings = agentSettingsMap[client.id];
  const hoursSetLookup = new Set(hoursSet);

  return (
    <div className="space-y-6">
      {/* Client Selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="voice-client-select" className="text-sm font-medium whitespace-nowrap">
          Client:
        </label>
        <select
          id="voice-client-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.businessName} {c.voiceEnabled ? '(Enabled)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* QA Checklist */}
      <VoiceQaChecklist
        clientId={client.id}
        voiceEnabled={client.voiceEnabled ?? false}
        checks={{
          greetingSet: !!(client.voiceGreeting && client.voiceGreeting.trim().length > 0),
          voiceSelected: !!client.voiceVoiceId,
          kbPopulated: (kbCountMap[client.id] ?? 0) >= 3,
          businessHoursSet: hoursSetLookup.has(client.id),
          agentToneSet: !!(agentSettings?.agentTone),
        }}
      />

      {/* Settings / Testing Tabs */}
      <Tabs defaultValue="settings">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <VoiceSettings
                clientId={client.id}
                settings={{
                  voiceEnabled: client.voiceEnabled ?? false,
                  voiceMode: client.voiceMode ?? 'after_hours',
                  voiceGreeting: client.voiceGreeting ?? '',
                  voiceMaxDuration: client.voiceMaxDuration ?? 300,
                  canDiscussPricing: agentSettings?.canDiscussPricing ?? false,
                }}
                voiceVoiceId={client.voiceVoiceId ?? null}
              />
              <VoicePicker
                clientId={client.id}
                currentVoiceId={client.voiceVoiceId ?? null}
              />
            </div>
            <VoiceComparison
              clientId={client.id}
              defaultText={client.voiceGreeting || `Hi! Thanks for calling ${client.businessName}. How can I help you today?`}
            />
          </div>
        </TabsContent>

        <TabsContent value="testing" className="mt-4 space-y-6">
          <VoicePlayground clientId={client.id} voiceVoiceId={client.voiceVoiceId ?? null} />
          <CallHistory clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
