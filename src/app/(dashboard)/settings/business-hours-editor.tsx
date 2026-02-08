'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface BusinessHour {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean | null;
}

export function BusinessHoursEditor({ clientId }: { clientId: string }) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHours();
  }, [clientId]);

  async function fetchHours() {
    const res = await fetch(`/api/business-hours?clientId=${clientId}`);
    const data: { hours?: BusinessHour[] } = await res.json();

    if (data.hours && data.hours.length > 0) {
      setHours(data.hours);
    } else {
      setHours(DAYS.map((_, i) => ({
        dayOfWeek: i,
        openTime: '08:00',
        closeTime: '18:00',
        isOpen: i >= 1 && i <= 5,
      })));
    }
    setLoading(false);
  }

  async function saveHours() {
    setSaving(true);
    await fetch('/api/business-hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, hours }),
    });
    setSaving(false);
  }

  function updateHour(dayOfWeek: number, field: string, value: string | boolean) {
    setHours(prev =>
      prev.map(h =>
        h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
      )
    );
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {hours.map((hour) => (
        <div key={hour.dayOfWeek} className="flex items-center gap-4">
          <div className="w-24">
            <Label>{DAYS[hour.dayOfWeek]}</Label>
          </div>
          <Switch
            checked={hour.isOpen || false}
            onCheckedChange={(checked) => updateHour(hour.dayOfWeek, 'isOpen', checked)}
          />
          {hour.isOpen && (
            <>
              <Input
                type="time"
                value={hour.openTime || '08:00'}
                onChange={(e) => updateHour(hour.dayOfWeek, 'openTime', e.target.value)}
                className="w-32"
              />
              <span>to</span>
              <Input
                type="time"
                value={hour.closeTime || '18:00'}
                onChange={(e) => updateHour(hour.dayOfWeek, 'closeTime', e.target.value)}
                className="w-32"
              />
            </>
          )}
          {!hour.isOpen && (
            <span className="text-muted-foreground">Closed</span>
          )}
        </div>
      ))}
      <Button onClick={saveHours} disabled={saving}>
        {saving ? 'Saving...' : 'Save Hours'}
      </Button>
    </div>
  );
}
