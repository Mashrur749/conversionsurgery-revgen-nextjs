'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ShieldOff, ShieldCheck } from 'lucide-react';

interface VoiceKillSwitchProps {
  isKilled: boolean;
}

export function VoiceKillSwitch({ isKilled }: VoiceKillSwitchProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch('/api/admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ops.kill_switch.voice_ai',
          value: isKilled ? 'false' : 'true',
          description: 'Global kill switch for Voice AI \u2014 bypasses AI for all clients',
        }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (isKilled) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-[#C15B2E]/30 bg-[#FDEAE4] px-5 py-4">
        <div className="flex items-center gap-3">
          <ShieldOff className="h-5 w-5 shrink-0 text-[#C15B2E]" />
          <div>
            <p className="font-semibold text-[#C15B2E]">Voice AI is PAUSED</p>
            <p className="text-sm text-[#C15B2E]/80">All incoming calls are forwarding to client owners</p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          disabled={loading}
          onClick={toggle}
          className="shrink-0"
        >
          {loading ? 'Resuming\u2026' : 'Resume Voice AI'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#3D7A50]/30 bg-[#E8F5E9] px-5 py-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[#3D7A50]" />
        <p className="text-sm font-medium text-[#3D7A50]">Voice AI is active across all clients</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={loading} className="shrink-0">
            Pause All Voice AI
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Voice AI for all clients?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately stops AI from answering calls across every client. All incoming calls
              will forward directly to the client&apos;s owner until you resume. Use this for
              emergencies or maintenance only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={toggle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Pausing\u2026' : 'Pause Voice AI'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
