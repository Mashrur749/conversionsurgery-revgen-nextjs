'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { MessageSquare, Search, Shield } from 'lucide-react';
import { VoiceSimulator } from './voice-simulator';
import { KbGapTest } from './kb-gap-test';
import { GuardrailTest } from './guardrail-test';

interface Props {
  clientId: string;
  voiceVoiceId?: string | null;
}

export function VoicePlayground({ clientId, voiceVoiceId }: Props) {
  return (
    <Card>
      <Tabs defaultValue="simulator">
        <TabsList className="w-full justify-start border-b rounded-none px-4 pt-2">
          <TabsTrigger value="simulator" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Simulator
          </TabsTrigger>
          <TabsTrigger value="kb-test" className="gap-1.5">
            <Search className="h-4 w-4" /> KB Test
          </TabsTrigger>
          <TabsTrigger value="guardrails" className="gap-1.5">
            <Shield className="h-4 w-4" /> Guardrails
          </TabsTrigger>
        </TabsList>
        <TabsContent value="simulator" className="p-4">
          <VoiceSimulator clientId={clientId} voiceVoiceId={voiceVoiceId} />
        </TabsContent>
        <TabsContent value="kb-test" className="p-4">
          <KbGapTest clientId={clientId} />
        </TabsContent>
        <TabsContent value="guardrails" className="p-4">
          <GuardrailTest clientId={clientId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
