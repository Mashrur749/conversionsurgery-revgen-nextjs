import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { CallHistory } from '@/components/voice/call-history';
import { VoicePicker } from './voice-picker';
import { ChevronDown } from 'lucide-react';

export default async function VoiceAIPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();
  const allClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      voiceEnabled: clients.voiceEnabled,
      voiceMode: clients.voiceMode,
      voiceGreeting: clients.voiceGreeting,
      voiceVoiceId: clients.voiceVoiceId,
    })
    .from(clients)
    .where(eq(clients.status, 'active'))
    .orderBy(clients.businessName);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Voice AI</h1>
        <p className="text-muted-foreground">
          Configure AI-powered voice answering for client phone lines
        </p>
      </div>

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
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 pb-6">
                <div className="space-y-4">
                  <VoiceSettings
                    clientId={client.id}
                    settings={{
                      voiceEnabled: client.voiceEnabled ?? false,
                      voiceMode: client.voiceMode ?? 'after_hours',
                      voiceGreeting: client.voiceGreeting ?? '',
                    }}
                  />
                  <VoicePicker
                    clientId={client.id}
                    currentVoiceId={client.voiceVoiceId ?? null}
                  />
                </div>
                <CallHistory clientId={client.id} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
