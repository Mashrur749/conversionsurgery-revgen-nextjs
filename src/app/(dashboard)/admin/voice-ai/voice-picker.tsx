'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2 } from 'lucide-react';

interface Voice {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl: string;
}

export function VoicePicker({
  clientId,
  currentVoiceId,
}: {
  clientId: string;
  currentVoiceId: string | null;
}) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(currentVoiceId || '');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/voice/voices')
      .then((r) => (r.ok ? (r.json() as Promise<Voice[]>) : ([] as Voice[])))
      .then((data) => setVoices(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceVoiceId: selectedId || null }),
    });
    setSaving(false);
  }

  async function handlePreview() {
    if (!selectedId) return;
    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: selectedId,
          text: 'Hello! Thank you for calling. How can I help you today?',
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
        }
      }
    } catch {}
    setPreviewing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ElevenLabs Voice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading voices...</p>
        ) : voices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ElevenLabs voices available. Check your API key.
          </p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full"
          >
            <option value="">Default (Twilio TTS)</option>
            {voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.name} ({v.category})
              </option>
            ))}
          </select>
        )}

        {selectedId && (
          <div className="flex items-center gap-2">
            {voices.find((v) => v.voiceId === selectedId)?.labels &&
              Object.entries(
                voices.find((v) => v.voiceId === selectedId)?.labels || {}
              ).map(([key, val]) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {val}
                </Badge>
              ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!selectedId || previewing}
          >
            <Volume2 className="h-4 w-4 mr-1" />
            {previewing ? 'Loading...' : 'Preview'}
          </Button>
        </div>

        <audio ref={audioRef} className="hidden" />
      </CardContent>
    </Card>
  );
}
