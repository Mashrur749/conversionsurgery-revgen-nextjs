'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  defaults: {
    agentTone: string;
    useEmojis: boolean;
    signMessages: boolean;
    primaryGoal: string;
    canScheduleAppointments: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
}

export function AiSettingsForm({ defaults }: Props) {
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/client/ai-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communication Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={form.agentTone} onValueChange={(v) => update('agentTone', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Use emojis in responses</Label>
            <input
              type="checkbox"
              checked={form.useEmojis}
              onChange={(e) => update('useEmojis', e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Sign messages with business name</Label>
            <input
              type="checkbox"
              checked={form.signMessages}
              onChange={(e) => update('signMessages', e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary goal</Label>
            <Select value={form.primaryGoal} onValueChange={(v) => update('primaryGoal', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="book_appointment">Book appointments</SelectItem>
                <SelectItem value="get_quote_request">Get quote requests</SelectItem>
                <SelectItem value="collect_info">Collect information</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>AI can schedule appointments</Label>
            <input
              type="checkbox"
              checked={form.canScheduleAppointments}
              onChange={(e) => update('canScheduleAppointments', e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiet Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable quiet hours</Label>
            <input
              type="checkbox"
              checked={form.quietHoursEnabled}
              onChange={(e) => update('quietHoursEnabled', e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          {form.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={form.quietHoursStart}
                  onChange={(e) => update('quietHoursStart', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="time"
                  value={form.quietHoursEnd}
                  onChange={(e) => update('quietHoursEnd', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
