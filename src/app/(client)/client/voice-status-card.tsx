'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneCall, Calendar, ArrowRight } from 'lucide-react';

interface VoiceStatusData {
  voiceEnabled: boolean;
  voiceMode: string;
  twilioNumber: string | null;
  thisWeek: {
    totalCalls: number;
    booked: number;
    transferred: number;
  };
}

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Strip leading country code (1 for US/CA) if 11 digits
  const local = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return raw;
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'always':
      return 'always';
    case 'after_hours':
      return 'after hours';
    case 'overflow':
      return 'when you can&apos;t answer';
    default:
      return mode;
  }
}

function VoiceSkeleton() {
  return (
    <Card className="border-[#6B7E54]/30">
      <CardHeader className="pb-3">
        <div className="h-5 w-24 rounded bg-[#C8D4CC] animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-[#C8D4CC] animate-pulse" />
          <div className="h-4 w-48 rounded bg-[#C8D4CC] animate-pulse" />
          <div className="h-4 w-40 rounded bg-[#C8D4CC] animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md border border-[#C8D4CC] bg-white p-3 space-y-1">
              <div className="h-6 w-8 rounded bg-[#C8D4CC] animate-pulse" />
              <div className="h-3 w-20 rounded bg-[#C8D4CC] animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function VoiceStatusCard() {
  const [data, setData] = useState<VoiceStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client/voice-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (
          json &&
          typeof json === 'object' &&
          'voiceEnabled' in json &&
          'thisWeek' in json
        ) {
          setData(json as VoiceStatusData);
        }
      })
      .catch(() => {
        // Silently fail — card will not render
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <VoiceSkeleton />;

  // Don&apos;t render if voice is off or data couldn&apos;t be loaded
  if (!data || !data.voiceEnabled) return null;

  const { voiceMode, twilioNumber, thisWeek } = data;
  const hasCallsThisWeek = thisWeek.totalCalls > 0;
  const modeLabel = getModeLabel(voiceMode);
  const formattedNumber = twilioNumber ? formatPhoneNumber(twilioNumber) : null;

  return (
    <Card className="border-[#6B7E54]/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#6B7E54]" />
            <CardTitle className="text-base font-semibold text-[#1B2F26]">Voice AI</CardTitle>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-xs font-medium text-[#3D7A50]">
            Active
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status details */}
        <div className="space-y-1 text-sm">
          <p className="text-[#1B2F26]">
            Answering{' '}
            <span className="font-medium">
              {voiceMode === 'overflow'
                ? 'when you can\u2019t answer'
                : modeLabel}
            </span>
          </p>
          {formattedNumber && (
            <p className="text-muted-foreground">{formattedNumber}</p>
          )}
        </div>

        {/* This week&apos;s call stats */}
        {hasCallsThisWeek ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="flex items-center gap-1 mb-1">
                <PhoneCall className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-[#1B2F26]">{thisWeek.totalCalls}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Calls Handled</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-[#1B2F26]">{thisWeek.booked}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Appointments Booked</div>
            </div>
            <div className="rounded-md border border-[#C8D4CC] bg-white p-3">
              <div className="flex items-center gap-1 mb-1">
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-[#1B2F26]">{thisWeek.transferred}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Transfers</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No voice calls this week yet</p>
        )}
      </CardContent>
    </Card>
  );
}
