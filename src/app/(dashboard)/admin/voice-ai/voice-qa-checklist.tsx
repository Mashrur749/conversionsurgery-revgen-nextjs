'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceQaChecklistProps {
  clientId: string;
  voiceEnabled: boolean;
  checks: {
    greetingSet: boolean;
    voiceSelected: boolean;
    kbPopulated: boolean;
    businessHoursSet: boolean;
    agentToneSet: boolean;
  };
}

export function VoiceQaChecklist({ clientId, voiceEnabled, checks }: VoiceQaChecklistProps) {
  const router = useRouter();
  const [greetingPreviewed, setGreetingPreviewed] = useState(false);
  const [simulatorTested, setSimulatorTested] = useState(false);
  const [guardrailsTested, setGuardrailsTested] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const autoChecks = [
    { label: 'Greeting', passed: checks.greetingSet },
    { label: 'Voice', passed: checks.voiceSelected },
    { label: 'KB', passed: checks.kbPopulated },
    { label: 'Hours', passed: checks.businessHoursSet },
    { label: 'Tone', passed: checks.agentToneSet },
  ];

  const manualChecks = [
    {
      id: 'greeting',
      label: 'I&apos;ve previewed the greeting audio',
      labelText: "I've previewed the greeting audio",
      checked: greetingPreviewed,
      toggle: () => setGreetingPreviewed((v) => !v),
    },
    {
      id: 'simulator',
      label: 'I&apos;ve tested at least one conversation',
      labelText: "I've tested at least one conversation",
      checked: simulatorTested,
      toggle: () => setSimulatorTested((v) => !v),
    },
    {
      id: 'guardrails',
      label: 'I&apos;ve run the guardrail stress test',
      labelText: "I've run the guardrail stress test",
      checked: guardrailsTested,
      toggle: () => setGuardrailsTested((v) => !v),
    },
  ];

  const allAutoPassed = autoChecks.every((c) => c.passed);
  const allManualPassed = manualChecks.every((c) => c.checked);
  const allPassed = allAutoPassed && allManualPassed;

  async function handleGoLive() {
    setEnabling(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceEnabled: true }),
      });
      if (!res.ok) throw new Error();
      toast.success('Voice AI enabled');
      router.refresh();
    } catch {
      toast.error('Failed to enable voice AI');
    } finally {
      setEnabling(false);
    }
  }

  async function handleDisable() {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceEnabled: false }),
      });
      if (!res.ok) throw new Error();
      toast.success('Voice AI disabled');
      router.refresh();
    } catch {
      toast.error('Failed to disable voice AI');
    }
  }

  if (voiceEnabled) {
    return (
      <Card className="border-[#6B7E54]/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#3D7A50]" />
              <span className="font-medium text-[#3D7A50]">Voice AI is LIVE</span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-[#C15B2E]">
                  Disable
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disable Voice AI?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately stop Voice AI from answering calls for this client.
                    Incoming calls will no longer be handled by the AI. You can re-enable at any
                    time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisable}
                    className="bg-[#C15B2E] hover:bg-[#C15B2E]/90"
                  >
                    Disable
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#6B7E54]/30">
      <CardContent className="py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Voice AI Readiness</h3>
            <Button
              size="sm"
              disabled={!allPassed || enabling}
              onClick={handleGoLive}
              className={allPassed ? 'bg-[#3D7A50] hover:bg-[#3D7A50]/90' : ''}
            >
              {enabling ? 'Enabling...' : 'Go Live'}
            </Button>
          </div>

          {/* Auto checks */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {autoChecks.map((check) => (
              <div key={check.label} className="flex items-center gap-1.5 text-xs">
                {check.passed ? (
                  <CheckCircle className="h-3.5 w-3.5 text-[#3D7A50] shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-[#C15B2E] shrink-0" />
                )}
                <span className={check.passed ? 'text-foreground' : 'text-[#C15B2E]'}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>

          {/* Manual QA section */}
          <div className="border-t pt-3 mt-3">
            <p className="text-xs text-muted-foreground mb-2">Operator QA</p>
            <div className="space-y-1.5">
              {manualChecks.map((check) => (
                <label key={check.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={check.checked}
                    onChange={() => check.toggle()}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  {check.labelText}
                </label>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
