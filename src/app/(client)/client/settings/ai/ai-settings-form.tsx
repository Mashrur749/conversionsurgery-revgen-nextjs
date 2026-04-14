'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning';

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
    bookingAggressiveness: number;
  };
}

export function AiSettingsForm({ defaults }: Props) {
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedForm, setSavedForm] = useState(defaults);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );
  useUnsavedChangesWarning(isDirty);

  const update = (key: string, value: string | boolean | number) => {
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
    if (res.ok) {
      setSaved(true);
      setSavedForm(form);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communication Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Tone</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sets the conversational style. Professional for corporate clients, friendly for residential.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
            <Label htmlFor="use-emojis">Use emojis in responses</Label>
            <Switch
              id="use-emojis"
              checked={form.useEmojis}
              onCheckedChange={(checked) => update('useEmojis', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sign-messages">Sign messages with business name</Label>
            <Switch
              id="sign-messages"
              checked={form.signMessages}
              onCheckedChange={(checked) => update('signMessages', checked)}
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
            <Label htmlFor="can-schedule">AI can schedule appointments</Label>
            <Switch
              id="can-schedule"
              checked={form.canScheduleAppointments}
              onCheckedChange={(checked) => update('canScheduleAppointments', checked)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="booking-aggressiveness">Booking Aggressiveness</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How proactively should the system suggest appointments? 1 = very gentle, 10 = very assertive.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">
              How proactively should the system suggest appointments? 1 = very gentle, 10 = very assertive.
            </p>
            <input
              id="booking-aggressiveness"
              type="range"
              min="1"
              max="10"
              value={form.bookingAggressiveness ?? 5}
              onChange={(e) => update('bookingAggressiveness', parseInt(e.target.value, 10))}
              className="w-full accent-[#6B7E54]"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Gentle</span>
              <span>{form.bookingAggressiveness ?? 5}/10</span>
              <span>Assertive</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-base">Quiet Hours</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Messages won&apos;t be sent outside these hours. Urgent escalations can override this.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours">Enable quiet hours</Label>
            <Switch
              id="quiet-hours"
              checked={form.quietHoursEnabled}
              onCheckedChange={(checked) => update('quietHoursEnabled', checked)}
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

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-[#3D7A50]">Saved</span>}
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
