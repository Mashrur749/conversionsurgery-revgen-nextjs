'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Phone, Clock, MessageSquare, Timer, DollarSign, Volume2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BusinessHoursSummary } from './business-hours-summary';

interface VoiceSettingsProps {
  clientId: string;
  settings: {
    voiceEnabled: boolean;
    voiceMode: string;
    voiceGreeting: string;
    voiceMaxDuration: number;
    canDiscussPricing: boolean;
  };
  voiceVoiceId?: string | null;
}

export function VoiceSettings({ clientId, settings, voiceVoiceId }: VoiceSettingsProps) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function previewGreeting() {
    if (!form.voiceGreeting.trim()) return;
    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voiceVoiceId || 'default',
          text: form.voiceGreeting,
        }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch {
      toast.error('Failed to preview greeting. Check your voice selection.');
    } finally {
      setPreviewing(false);
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      const [voiceRes, agentRes] = await Promise.all([
        fetch(`/api/admin/clients/${clientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceEnabled: form.voiceEnabled,
            voiceMode: form.voiceMode,
            voiceGreeting: form.voiceGreeting,
            voiceMaxDuration: form.voiceMaxDuration,
          }),
        }),
        fetch(`/api/admin/clients/${clientId}/agent-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canDiscussPricing: form.canDiscussPricing,
          }),
        }),
      ]);

      if (!voiceRes.ok || !agentRes.ok) throw new Error('Failed to save');
      toast.success('Voice settings saved!');
    } catch {
      toast.error('Failed to save voice settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice AI Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Voice AI</Label>
            <p className="text-sm text-muted-foreground">
              AI will answer calls based on mode
            </p>
          </div>
          <Switch
            checked={form.voiceEnabled}
            onCheckedChange={(v) => setForm({ ...form, voiceEnabled: v })}
          />
        </div>

        {form.voiceEnabled && (
          <>
            {/* Mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Answer Mode
              </Label>
              <Select
                value={form.voiceMode}
                onValueChange={(v) => setForm({ ...form, voiceMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_hours">After Hours Only</SelectItem>
                  <SelectItem value="overflow">Overflow (No Answer)</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.voiceMode === 'after_hours' && 'AI answers when business is closed (uses business hours config)'}
                {form.voiceMode === 'overflow' && 'AI answers when no one picks up within 20 seconds'}
                {form.voiceMode === 'always' && 'AI always answers incoming calls'}
              </p>
              {form.voiceMode === 'after_hours' && (
                <BusinessHoursSummary clientId={clientId} />
              )}
            </div>

            {/* Greeting */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Greeting Message
              </Label>
              <Textarea
                value={form.voiceGreeting}
                onChange={(e) =>
                  setForm({ ...form, voiceGreeting: e.target.value })
                }
                placeholder="Hi! Thanks for calling ABC Services. How can I help you today?"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This is what callers hear first when AI answers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={previewGreeting}
                  disabled={previewing || !form.voiceGreeting.trim()}
                  className="text-[#6B7E54] border-[#6B7E54]/30 hover:bg-[#E3E9E1]"
                >
                  {previewing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Volume2 className="h-4 w-4 mr-1" />
                  )}
                  {previewing ? 'Generating...' : 'Preview Greeting'}
                </Button>
                {!voiceVoiceId && (
                  <span className="text-xs text-muted-foreground">(Using default voice)</span>
                )}
              </div>
              <audio ref={audioRef} className="hidden" />
            </div>

            {/* Max call duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Timer className="h-4 w-4" />
                Max Call Duration
              </Label>
              <select
                value={String(form.voiceMaxDuration)}
                onChange={(e) => setForm({ ...form, voiceMaxDuration: Number(e.target.value) })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="120">2 minutes</option>
                <option value="180">3 minutes</option>
                <option value="300">5 minutes (default)</option>
                <option value="480">8 minutes</option>
                <option value="600">10 minutes</option>
                <option value="900">15 minutes</option>
              </select>
              <p className="text-xs text-muted-foreground">
                AI will wrap up the conversation after this time
              </p>
            </div>

            {/* Pricing discussion */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Discuss Pricing
                </Label>
                <p className="text-xs text-muted-foreground">
                  AI can share price ranges from the knowledge base with callers
                </p>
              </div>
              <Switch
                checked={form.canDiscussPricing}
                onCheckedChange={(v) =>
                  setForm({ ...form, canDiscussPricing: v })
                }
              />
            </div>
          </>
        )}

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Voice Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
