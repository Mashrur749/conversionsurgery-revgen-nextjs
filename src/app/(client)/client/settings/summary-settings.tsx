'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];

interface Props {
  enabled: boolean;
  day: number;
  time: string;
}

export function SummarySettings({ enabled, day, time }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState({ enabled, day, time });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch('/api/client/settings/summary', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Receive weekly summary</Label>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
        />
      </div>

      {settings.enabled && (
        <>
          <div className="space-y-2">
            <Label>Day of week</Label>
            <Select
              value={settings.day.toString()}
              onValueChange={(v) => setSettings({ ...settings, day: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <Select
              value={settings.time}
              onValueChange={(v) => setSettings({ ...settings, time: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
