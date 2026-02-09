'use client';

import { useState } from 'react';
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
import { Phone, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceSettingsProps {
  clientId: string;
  settings: {
    voiceEnabled: boolean;
    voiceMode: string;
    voiceGreeting: string;
  };
}

export function VoiceSettings({ clientId, settings }: VoiceSettingsProps) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceEnabled: form.voiceEnabled,
          voiceMode: form.voiceMode,
          voiceGreeting: form.voiceGreeting,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
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
                placeholder="Hi! Thanks for calling ABC Roofing. How can I help you today?"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This is what callers hear first when AI answers
              </p>
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
