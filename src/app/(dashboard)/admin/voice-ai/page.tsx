import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { CallHistory } from '@/components/voice/call-history';

export default async function VoiceAIPage() {
  const session = await auth();

  if (!(session as any)?.user?.isAdmin) {
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
        <div className="space-y-8">
          {allClients.map((client) => (
            <div key={client.id} className="space-y-4">
              <h2 className="text-lg font-semibold">{client.businessName}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <VoiceSettings
                  clientId={client.id}
                  settings={{
                    voiceEnabled: client.voiceEnabled ?? false,
                    voiceMode: client.voiceMode ?? 'after_hours',
                    voiceGreeting: client.voiceGreeting ?? '',
                  }}
                />
                <CallHistory clientId={client.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
