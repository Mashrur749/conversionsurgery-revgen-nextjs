'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Volume2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Voice {
  voiceId: string;
  name: string;
  category: string;
}

interface VoiceComparisonProps {
  clientId: string;
  defaultText: string;
}

interface SlotState {
  voiceId: string;
  loading: boolean;
}

const SLOT_COUNT = 3;

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

export function VoiceComparison({ clientId: _clientId, defaultText }: VoiceComparisonProps) {
  const [text, setText] = useState(defaultText);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [slots, setSlots] = useState<SlotState[]>(
    Array.from({ length: SLOT_COUNT }, () => ({ voiceId: '', loading: false }))
  );
  const [comparingAll, setComparingAll] = useState(false);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>(Array(SLOT_COUNT).fill(null));

  useEffect(() => {
    async function fetchVoices() {
      try {
        const res = await fetch('/api/admin/voice/voices');
        if (!res.ok) throw new Error('Failed to fetch voices');
        const data = (await res.json()) as { voices: Voice[] };
        setVoices(data.voices ?? []);
        // Pre-select first voice in each slot if available
        if (data.voices && data.voices.length > 0) {
          setSlots((prev) =>
            prev.map((slot, i) => ({
              ...slot,
              voiceId: data.voices[Math.min(i, data.voices.length - 1)]?.voiceId ?? '',
            }))
          );
        }
      } catch {
        toast.error('Failed to load voices for comparison');
      } finally {
        setLoadingVoices(false);
      }
    }
    fetchVoices();
  }, []);

  async function playSlot(index: number): Promise<void> {
    const slot = slots[index];
    if (!slot.voiceId || !text.trim()) return;

    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, loading: true } : s))
    );

    try {
      const res = await fetch('/api/admin/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: slot.voiceId, text }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRefs.current[index];
      if (audio) {
        audio.src = url;
        await audio.play();
      }
    } catch {
      toast.error('Failed to preview voice. Try again.');
    } finally {
      setSlots((prev) =>
        prev.map((s, i) => (i === index ? { ...s, loading: false } : s))
      );
    }
  }

  async function compareAll() {
    if (!text.trim()) return;
    const activeSlots = slots
      .map((s, i) => ({ ...s, index: i }))
      .filter((s) => s.voiceId);
    if (activeSlots.length === 0) return;

    setComparingAll(true);
    try {
      for (const slot of activeSlots) {
        await playSlot(slot.index);
        // Small gap between samples so the operator can distinguish them
        await new Promise<void>((resolve) => setTimeout(resolve, 800));
      }
    } finally {
      setComparingAll(false);
    }
  }

  const grouped = voices.reduce<Record<string, Voice[]>>((acc, v) => {
    const cat = v.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Compare Voices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Sample Text</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Enter text to preview across voices&hellip;"
          />
          <p className="text-xs text-muted-foreground">
            Edit the text above to hear how each voice sounds on your exact greeting
          </p>
        </div>

        {loadingVoices ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading voices&hellip;
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-6 shrink-0">
                  {i + 1}.
                </span>
                <select
                  value={slot.voiceId}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((s, idx) =>
                        idx === i ? { ...s, voiceId: e.target.value } : s
                      )
                    )
                  }
                  className={SELECT_CLASS}
                  disabled={voices.length === 0}
                >
                  <option value="">Select a voice&hellip;</option>
                  {Object.entries(grouped).map(([cat, catVoices]) => (
                    <optgroup key={cat} label={cat}>
                      {catVoices.map((v) => (
                        <option key={v.voiceId} value={v.voiceId}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => playSlot(i)}
                  disabled={slot.loading || !slot.voiceId || !text.trim() || comparingAll}
                  className="shrink-0 text-[#6B7E54] border-[#6B7E54]/30 hover:bg-[#E3E9E1]"
                >
                  {slot.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Play</span>
                </Button>
                <audio
                  ref={(el) => {
                    audioRefs.current[i] = el;
                  }}
                  className="hidden"
                />
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={compareAll}
          disabled={
            comparingAll ||
            !text.trim() ||
            loadingVoices ||
            slots.every((s) => !s.voiceId)
          }
          className="w-full text-[#6B7E54] border-[#6B7E54]/30 hover:bg-[#E3E9E1]"
        >
          {comparingAll ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Playing all&hellip;
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              Compare All
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
